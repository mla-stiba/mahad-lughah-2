import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ HASIL / DASHBOARD API ============
// GET /api/hasil?action=overview                  (overview semua) — CACHED 5min
// GET /api/hasil?action=by-kamar&sesiId=xxx
// GET /api/hasil?action=by-materi&sesiId=xxx     (item analysis)
// GET /api/hasil?action=by-mahasiswa&mahasiswaId=xxx
// GET /api/hasil?action=cross-tab&sesiId=xxx     (kamar x materi)
// GET /api/hasil?action=detail&hasilId=xxx       (detail satu hasil)
// GET /api/hasil?action=all&sesiId=xxx

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const sesiId = searchParams.get('sesiId')
  const mahasiswaId = searchParams.get('mahasiswaId')

  if (action === 'overview') {
    // FIX v3.3.12: cache overview 5 menit — data jarang berubah, tapi query berat
    // (fetch semua hasil + relations). Invalidate saat ada new hasil/submit.
    const data = await cacheable('hasil:overview', async () => {
      const [totalMhs, totalSesi, totalMateri, totalKamar] = await Promise.all([
        db.mahasiswa.count(),
        db.sesiUjian.count(),
        db.materi.count(),
        db.kamar.count(),
      ])

      const allHasil = await db.hasilUjian.findMany({
        where: { status: { in: ['submitted', 'graded'] } },
        select: {
          id: true,
          mahasiswaId: true,
          sesiId: true,
          skorTotal: true,
          jumlahBenar: true,
          jumlahSoal: true,
          selesai: true,
          mahasiswa: { include: { kamar: true } },
          sesi: { select: { nama: true, levelId: true } },
        },
      })

      const avgScore = allHasil.length > 0
        ? allHasil.reduce((sum, h) => sum + (h.skorTotal || 0), 0) / allHasil.length
        : 0

      const bySesi: Record<string, { nama: string; avg: number; count: number }> = {}
      for (const h of allHasil) {
        const key = h.sesiId
        if (!bySesi[key]) bySesi[key] = { nama: h.sesi.nama, avg: 0, count: 0 }
        bySesi[key].avg += h.skorTotal || 0
        bySesi[key].count += 1
      }
      Object.values(bySesi).forEach(s => { s.avg = s.avg / s.count })

      return {
        totalMhs,
        totalSesi,
        totalMateri,
        totalKamar,
        totalHasil: allHasil.length,
        avgScore,
        bySesi: Object.entries(bySesi).map(([id, v]) => ({ id, ...v })),
      }
    }, 300) // 5 min cache

    return NextResponse.json({ data })
  }

  if (action === 'by-kamar') {
    // FIX perf: ganti `include` (ambil semua kolom) dengan `select` eksplisit
    // — hindari kirim berat fields (socialEmbed JSON, documentUrl, dll) ke client
    const hasil = await db.hasilUjian.findMany({
      where: sesiId ? { sesiId } : { status: { in: ['submitted', 'graded'] } },
      select: {
        id: true, mahasiswaId: true, sesiId: true, skorTotal: true,
        jumlahBenar: true, jumlahSoal: true, status: true, selesai: true,
        mahasiswa: {
          select: { id: true, nama: true, nim: true, kamarId: true,
            kamar: { select: { id: true, nama: true } },
          },
        },
        sesi: { select: { id: true, nama: true } },
      },
    })

    const byKamar: Record<string, { nama: string; avg: number; count: number; hasil: any[] }> = {}
    for (const h of hasil) {
      const k = h.mahasiswa.kamar
      if (!byKamar[k.id]) byKamar[k.id] = { nama: k.nama, avg: 0, count: 0, hasil: [] }
      byKamar[k.id].avg += h.skorTotal || 0
      byKamar[k.id].count += 1
      byKamar[k.id].hasil.push(h)
    }
    Object.values(byKamar).forEach(s => { s.avg = s.avg / s.count })

    return NextResponse.json({ data: Object.entries(byKamar).map(([id, v]) => ({ id, ...v })) })
  }

  if (action === 'by-materi') {
    // Item analysis: per soal, berapa % benar
    const sesi = await db.sesiUjian.findUnique({
      where: { id: sesiId! },
      include: { soal: { orderBy: { no: 'asc' }, include: { materi: true } } },
    })
    if (!sesi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const detail = await db.detailHasil.findMany({
      where: { hasil: { sesiId: sesiId! } },
    })

    const bySoal: Record<string, { no: number; pertanyaan: string; arabic: string; benar: number; total: number }> = {}
    for (const soal of sesi.soal) {
      bySoal[soal.id] = {
        no: soal.no,
        pertanyaan: soal.pertanyaan,
        arabic: soal.pertanyaanArabic || soal.materi?.arabic || '',
        benar: 0,
        total: 0,
      }
    }
    for (const d of detail) {
      if (bySoal[d.soalId]) {
        bySoal[d.soalId].total += 1
        if (d.benar) bySoal[d.soalId].benar += 1
      }
    }

    return NextResponse.json({
      data: Object.entries(bySoal).map(([id, v]) => ({
        id,
        ...v,
        accuracy: v.total > 0 ? (v.benar / v.total) * 100 : 0,
      })),
    })
  }

  if (action === 'by-mahasiswa') {
    const hasil = await db.hasilUjian.findMany({
      where: { mahasiswaId: mahasiswaId!, status: { in: ['submitted', 'graded'] } },
      include: { sesi: true, detail: { include: { soal: true } } },
      orderBy: { selesai: 'asc' },
    })
    return NextResponse.json({ data: hasil })
  }

  if (action === 'cross-tab') {
    // Crosstab: kamar x materi (accuracy)
    const sesi = await db.sesiUjian.findUnique({
      where: { id: sesiId! },
      include: { soal: { orderBy: { no: 'asc' }, include: { materi: true } } },
    })
    if (!sesi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const detail = await db.detailHasil.findMany({
      where: { hasil: { sesiId: sesiId! } },
      include: { hasil: { include: { mahasiswa: { include: { kamar: true } } } } },
    })

    // Map: kamar -> soalId -> {benar, total}
    const matrix: Record<string, { kamarNama: string; cells: Record<string, { benar: number; total: number; accuracy: number }> }> = {}
    for (const d of detail) {
      const kamarId = d.hasil.mahasiswa.kamar.id
      const kamarNama = d.hasil.mahasiswa.kamar.nama
      if (!matrix[kamarId]) matrix[kamarId] = { kamarNama, cells: {} }
      if (!matrix[kamarId].cells[d.soalId]) {
        matrix[kamarId].cells[d.soalId] = { benar: 0, total: 0, accuracy: 0 }
      }
      matrix[kamarId].cells[d.soalId].total += 1
      if (d.benar) matrix[kamarId].cells[d.soalId].benar += 1
    }
    Object.values(matrix).forEach(k => {
      Object.values(k.cells).forEach(c => {
        c.accuracy = c.total > 0 ? (c.benar / c.total) * 100 : 0
      })
    })

    return NextResponse.json({
      data: {
        soal: sesi.soal.map(s => ({ id: s.id, no: s.no, arabic: s.pertanyaanArabic || s.materi?.arabic || s.pertanyaan, arti: s.materi?.arti })),
        matrix: Object.entries(matrix).map(([kamarId, v]) => ({ kamarId, ...v })),
      },
    })
  }

  if (action === 'detail') {
    const hasilId = searchParams.get('hasilId')
    const hasil = await db.hasilUjian.findUnique({
      where: { id: hasilId! },
      include: {
        sesi: { include: { soal: { orderBy: { no: 'asc' }, include: { materi: true } } } },
        mahasiswa: { include: { kamar: true } },
        detail: true,
      },
    })
    if (!hasil) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: hasil })
  }

  if (action === 'all') {
    const hasil = await db.hasilUjian.findMany({
      where: sesiId ? { sesiId } : {},
      include: {
        sesi: true,
        mahasiswa: { include: { kamar: true } },
      },
      orderBy: { selesai: 'desc' },
    })
    return NextResponse.json({ data: hasil })
  }

  // FIX v3.0.6 #2: action=by-sesi-all — list SEMUA mahasiswa + hasil tes untuk sesi tertentu.
  // Mahasiswa yang gak ada hasil tes → status 'tidak_ikut' (manualGrade null).
  // FIX v3.0.9: gabung mhs ambil tes + mhs di pesertaJson.
  // FIX v3.1.0: BUG SEBENARNYA — hapus filter mhsIdsInHasil. Selalu return SEMUA mhs di sistem
  // (245 total), supaya yang gak ikut juga tampil dengan status 'tidak_ikut'.
  // Sebelumnya: hanya mhs yang ambil tes (228) + mhs di pesertaJson. Mhs gak ambil + gak di
  // pesertaJson → gak tampil → user lihat cuma 228 padahal seharusnya 245.
  if (action === 'by-sesi-all') {
    if (!sesiId) return NextResponse.json({ error: 'sesiId required' }, { status: 400 })
    const sesi = await db.sesiUjian.findUnique({
      where: { id: sesiId },
      include: { _count: { select: { soal: true } } },
    })
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    // Ambil SEMUA hasil tes untuk sesi ini (untuk lookup per mhs).
    const allHasil = await db.hasilUjian.findMany({
      where: { sesiId },
      include: { detail: true },
    })
    const hasilByMhs = new Map(allHasil.map(h => [h.mahasiswaId, h]))

    // FIX v3.1.0: ALWAYS return SEMUA mhs di sistem (take 2000 — cukup untuk pesantren besar).
    // Sebelumnya filter by mhsIdsInHasil + pesertaMhsIds. Sekarang tidak ada filter — semua mhs
    // muncul, kalau gak ada hasil tes → status 'tidak_ikut'.
    const allMhs = await db.mahasiswa.findMany({
      include: { kamar: { select: { id: true, nama: true } } },
      orderBy: [
        { kamar: { nama: 'asc' } },
        { nim: 'asc' },
      ],
      take: 2000,
    })

    // Combine: tiap mhs + hasil (kalau ada) atau status 'tidak_ikut'
    const data = allMhs.map(m => {
      const hasil = hasilByMhs.get(m.id)
      return {
        mahasiswa: {
          id: m.id,
          nim: m.nim,
          nama: m.nama,
          kamar: m.kamar,
        },
        hasil: hasil ? {
          id: hasil.id,
          status: hasil.status,
          skorTotal: hasil.skorTotal,
          jumlahBenar: hasil.jumlahBenar,
          jumlahSoal: hasil.jumlahSoal,
          selesai: hasil.selesai,
          manualGrade: hasil.manualGrade,
          manualNote: hasil.manualNote,
          catatan: hasil.catatan,
        } : null,
      }
    })

    return NextResponse.json({ data: { sesi, mahasiswa: data } })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

// ============ POST HANDLER ============
// FIX v3.0.6 #1: action=set-manual-grade — set manualGrade + manualNote untuk hasil tes.
// Kalau mhs belum punya hasil tes (gak ikut), create record baru dengan status='tidak_ikut'.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = body.action

  // FIX v3.3.12: invalidate cache saat ada perubahan data hasil
  const invalidateHasilCache = () => {
    invalidatePattern('hasil:*')
  }

  // FIX v3.1.0: action=create-manual-hasil — admin manually input hasil tes record.
  // User request: tombol "Tambah Data Hasil Ujian" → input NIM + nilai + waktu + catatan.
  // Untuk mhs yang gak ikut tes tapi admin mau kasih nilai manual (mis. dispensasi).
  if (action === 'create-manual-hasil') {
    const { sesiId, mahasiswaId, skorTotal, selesai, catatan, manualNote, jumlahBenar, jumlahSoal } = body
    if (!sesiId || !mahasiswaId) {
      return NextResponse.json({ error: 'sesiId + mahasiswaId required' }, { status: 400 })
    }

    // Cek apakah sudah ada hasil untuk (sesiId, mahasiswaId)
    const existing = await db.hasilUjian.findUnique({
      where: { sesiId_mahasiswaId: { sesiId, mahasiswaId } },
    })

    const skor = skorTotal !== null && skorTotal !== undefined ? Number(skorTotal) : 0
    const benar = jumlahBenar !== null && jumlahBenar !== undefined ? Number(jumlahBenar) : 0
    const total = jumlahSoal !== null && jumlahSoal !== undefined ? Number(jumlahSoal) : 0
    const selesaiDate = selesai ? new Date(selesai) : new Date()
    const note = manualNote || catatan || null

    if (existing) {
      // Update existing hasil dengan data manual (override skor tes + catatan)
      const updated = await db.hasilUjian.update({
        where: { id: existing.id },
        data: {
          status: 'graded',
          skorTotal: skor,
          jumlahBenar: benar,
          jumlahSoal: total,
          selesai: selesaiDate,
          catatan: note,
          manualNote: note,
          manualGrade: skor,
        },
      })
      invalidateHasilCache()
      return NextResponse.json({ data: updated })
    } else {
      // Create baru untuk mhs yang belum ada hasil tes
      const created = await db.hasilUjian.create({
        data: {
          sesiId,
          mahasiswaId,
          status: 'graded',
          skorTotal: skor,
          jumlahBenar: benar,
          jumlahSoal: total,
          selesai: selesaiDate,
          catatan: note,
          manualNote: note,
          manualGrade: skor,
        },
      })
      invalidateHasilCache()
      return NextResponse.json({ data: created })
    }
  }

  if (action === 'set-manual-grade') {
    const { sesiId, mahasiswaId, manualGrade, manualNote } = body
    if (!sesiId || !mahasiswaId) {
      return NextResponse.json({ error: 'sesiId + mahasiswaId required' }, { status: 400 })
    }

    // Cek apakah sudah ada hasil untuk (sesiId, mahasiswaId)
    const existing = await db.hasilUjian.findUnique({
      where: { sesiId_mahasiswaId: { sesiId, mahasiswaId } },
    })

    if (existing) {
      // Update manualGrade + manualNote
      const updated = await db.hasilUjian.update({
        where: { id: existing.id },
        data: {
          manualGrade: manualGrade !== null && manualGrade !== undefined ? Number(manualGrade) : null,
          manualNote: manualNote || null,
          // Kalau status masih ongoing, mark sebagai graded (admin override)
          status: existing.status === 'ongoing' ? 'graded' : existing.status,
          selesai: existing.selesai || new Date(),
        },
      })
      invalidateHasilCache()
      return NextResponse.json({ data: updated })
    } else {
      // Mhs belum ada hasil tes (gak ikut) — create baru dengan status='tidak_ikut'
      const created = await db.hasilUjian.create({
        data: {
          sesiId,
          mahasiswaId,
          status: 'tidak_ikut',
          manualGrade: manualGrade !== null && manualGrade !== undefined ? Number(manualGrade) : null,
          manualNote: manualNote || null,
          // Skor di-override pakai manualGrade kalau ada
          skorTotal: manualGrade !== null && manualGrade !== undefined ? Number(manualGrade) : 0,
          jumlahBenar: 0,
          jumlahSoal: 0,
        },
      })
      invalidateHasilCache()
      return NextResponse.json({ data: created })
    }
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
