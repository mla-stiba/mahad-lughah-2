import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ KEGIATAN KAMAR API ============
// GET /api/kegiatan?kamarId=xxx → ambil kegiatan hari ini untuk kamar
// GET /api/kegiatan?kamarId=xxx&action=latest → ambil kegiatan terbaru (bukan hari ini)
// GET /api/kegiatan?action=summary&date=YYYY-MM-DD&lantai=XX → bundle SEMUA kamar + kegiatan + hafalan summary
//      (FIX perf: 1 request pengganti N+1 fetch per-kamar di KegiatanView)
// POST /api/kegiatan { kamarId, kegiatan, inputBy } → upsert kegiatan hari ini

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kamarId = searchParams.get('kamarId')
  const action = searchParams.get('action')
  const dateStr = searchParams.get('date')
  const lantai = searchParams.get('lantai')

  // ====== ACTION: summary — bundle untuk KegiatanView (1 fetch, bukan 50) ======
  // Fix N+1: sebelumnya KegiatanView trigger 2 fetch per-kamar × 25 kamar = 50 request.
  // Sekarang 1 request saja yang return list kamar + kegiatan-per-tanggal + hafalan-per-kamar.
  if (action === 'summary') {
    // FIX v3.5.0: cache summary 2 menit — query berat (5 DB queries, ~34K tracking records)
    const cacheKey = `kegiatan:summary:${dateStr || 'today'}:${lantai || 'all'}:${searchParams.get('paketIds') || ''}`
    const data = await cacheable(cacheKey, async () => {
    const start = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
    const end = dateStr ? new Date(dateStr + 'T23:59:59.999') : new Date()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
    const useTodayRange = !dateStr
    const rangeStart = useTodayRange ? startOfToday : start
    const rangeEnd = useTodayRange ? endOfToday : end

    // 1 query: semua kamar
    const allKamars = await db.kamar.findMany({
      orderBy: { nama: 'asc' },
      select: { id: true, nama: true },
      take: 200,
    })
    const filtered = lantai && lantai !== 'all'
      ? allKamars.filter(k => {
          const parts = k.nama.split('.')
          return parts.length >= 2 && parts[1] === lantai
        })
      : allKamars
    const kamarIds = filtered.map(k => k.id)

    if (kamarIds.length === 0) {
      return { kamars: [], kegiatanMap: {}, hafalanMap: {}, anggotaMap: {} }
    }

    // 1 query: semua kegiatan untuk kamar-kamar di tanggal itu
    const allKegiatan = await db.kegiatanKamar.findMany({
      where: {
        kamarId: { in: kamarIds },
        tanggal: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true, kamarId: true, kegiatan: true, inputBy: true, tanggal: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    const kegiatanMap: Record<string, any> = {}
    for (const k of allKegiatan) {
      if (!kegiatanMap[k.kamarId]) kegiatanMap[k.kamarId] = k
    }

    // 1 query: semua anggota untuk kamar-kamar itu (untuk count + list)
    const allAnggota = await db.mahasiswa.findMany({
      where: { kamarId: { in: kamarIds } },
      select: {
        id: true, nim: true, nama: true, isKetuaKamar: true, kamarId: true,
      },
      orderBy: { nama: 'asc' },
      take: 500,
    })
    const anggotaByKamar: Record<string, any[]> = {}
    for (const m of allAnggota) {
      if (!anggotaByKamar[m.kamarId]) anggotaByKamar[m.kamarId] = []
      anggotaByKamar[m.kamarId].push(m)
    }
    const mhsIds = allAnggota.map(a => a.id)

    // 1 query: materi yang sudah rilis (untuk hafalan tracking)
    // FIX v3.0.2: support filter paketIds (comma-separated) — untuk filter grafik progres hafalan
    // by paket materi yang dipilih user di DashboardView. Default: semua materi (lepas + di paket).
    const now = new Date()
    const paketIdsParam = searchParams.get('paketIds')
    let paketFilter: any = undefined
    if (paketIdsParam !== null && paketIdsParam !== '') {
      // user pilih paket spesifik — filter materi yang paketId-nya di list tsb.
      // Materi lepas (paketId=null) TIDAK ikut kalau user pilih paket spesifik.
      const idArr = paketIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      paketFilter = { in: idArr }
    } else if (paketIdsParam === '') {
      // paketIds='' → semua paket (default) — gak filter paketId
      paketFilter = undefined
    }
    const materiList = await db.materi.findMany({
      where: {
        OR: [{ tanggalRilis: { lte: now } }, { tanggalRilis: null }],
        ...(paketFilter !== undefined ? { paketId: paketFilter } : {}),
      },
      select: { id: true },
      // FIX v3.0.3: take 200 → 500 — support 115+ materi (sebelumnya 15+ terpotong).
      take: 500,
    })
    const materiIds = materiList.map(m => m.id)

    // 1 query: semua hafalan tracking untuk anggota-anggota kamar tsb
    const allTracking = await db.hafalanTracking.findMany({
      where: {
        mahasiswaId: { in: mhsIds },
        materiId: { in: materiIds },
      },
      select: { mahasiswaId: true, materiId: true, status: true, updatedAt: true },
    })

    // Build per-kamar hafalan summary + per-anggota materi grid
    const hafalanMap: Record<string, any> = {}
    const anggotaGridMap: Record<string, any[]> = {}
    const trackingByMhs: Record<string, Map<string, string>> = {}
    for (const t of allTracking) {
      if (!trackingByMhs[t.mahasiswaId]) trackingByMhs[t.mahasiswaId] = new Map()
      trackingByMhs[t.mahasiswaId].set(t.materiId, t.status)
    }

    for (const k of filtered) {
      const anggota = anggotaByKamar[k.id] || []
      const rows = anggota.map(m => {
        const tMap = trackingByMhs[m.id] || new Map()
        const materi = materiIds.map(mid => ({
          materiId: mid,
          status: tMap.get(mid) || 'belum',
        }))
        return { mahasiswa: m, materi }
      })
      anggotaGridMap[k.id] = rows

      let totalHafal = 0, totalJumlah = 0, totalMateri = 0
      for (const row of rows) {
        for (const cell of row.materi) {
          totalMateri++
          // FIX v2.9.2: "hafal" sekarang INCLUDES "jumlah" (jumlah = subset hafal).
          // Sebelumnya: hafal dan jumlah dihitung terpisah, sehingga hafal "berkurang"
          // kalau ada mhs yang statusnya jumlah. Sekarang: status='jumlah' juga terhitung hafal.
          if (cell.status === 'hafal' || cell.status === 'jumlah') totalHafal++
          if (cell.status === 'jumlah') totalJumlah++
        }
      }
      hafalanMap[k.id] = {
        hafal: totalHafal,           // SUPERSET: hafal + jumlah (semua yang paham)
        jumlah: totalJumlah,         // SUBSET: yang statusnya spesifik 'jumlah'
        total: totalMateri,
        anggota: rows.length,
        rows,
      }
    }

    return {
      kamars: filtered,
      kegiatanMap,
      hafalanMap,
      anggotaMap: anggotaGridMap,
    }
    }, 120) // 2 min cache
    return NextResponse.json({ data })
  }

  if (!kamarId) return NextResponse.json({ error: 'kamarId required' }, { status: 400 })

  // Cari kegiatan hari ini untuk kamar ini
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  if (action === 'latest') {
    // Ambil kegiatan terbaru (bisa hari ini atau hari sebelumnya)
    const latest = await db.kegiatanKamar.findFirst({
      where: { kamarId },
      orderBy: { tanggal: 'desc' },
      select: { id: true, kamarId: true, kegiatan: true, inputBy: true, tanggal: true, updatedAt: true },
    })
    return NextResponse.json({ data: latest })
  }

  // Default: ambil kegiatan hari ini
  const today = await db.kegiatanKamar.findFirst({
    where: {
      kamarId,
      tanggal: { gte: startOfToday, lte: endOfToday },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, kamarId: true, kegiatan: true, inputBy: true, tanggal: true, updatedAt: true },
  })
  return NextResponse.json({ data: today })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { kamarId, kegiatan, inputBy } = body

  if (!kamarId || !kegiatan) {
    return NextResponse.json({ error: 'kamarId dan kegiatan wajib' }, { status: 400 })
  }

  // Cek apakah sudah ada kegiatan untuk hari ini
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const existing = await db.kegiatanKamar.findFirst({
    where: {
      kamarId,
      tanggal: { gte: startOfToday, lte: endOfToday },
    },
  })

  if (existing) {
    // Update kegiatan hari ini
    const updated = await db.kegiatanKamar.update({
      where: { id: existing.id },
      data: { kegiatan, inputBy: inputBy || existing.inputBy },
    })
    invalidatePattern('kegiatan:*')
    return NextResponse.json({ data: updated })
  }

  // Create baru untuk hari ini
  const created = await db.kegiatanKamar.create({
    data: { kamarId, kegiatan, inputBy: inputBy || null },
  })
  invalidatePattern('kegiatan:*')
  return NextResponse.json({ data: created })
}
