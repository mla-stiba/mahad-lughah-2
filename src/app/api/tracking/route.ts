import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ TRACKING API ============
// GET  /api/tracking?action=daily-summary
//      -> { totalMahasiswa, sudahLogin, belumLogin, loginRate }
// GET  /api/tracking?action=belum-login-hari-ini
//      -> { data: Mahasiswa[] yang belum login hari ini }
// GET  /api/tracking?action=kamar-status&kamarId=xxx
//      -> { kamar, ketua, anggota: [{ mahasiswa, loginToday, lastLogin }] }
// GET  /api/tracking?action=belum-view-materi&materiId=xxx
//      -> { data: Mahasiswa[] yang belum view materi tertentu }
// GET  /api/tracking?action=belum-view-materi-hari-ini
//      -> { data: [{ materi, belumView: [...] }] } untuk semua materi hari ini
// POST /api/tracking?action=view-materi { mahasiswaId, materiId }
//      -> record view event

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Cutoff: awal hari ini (00:00 local time)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  if (action === 'daily-summary') {
    const totalMahasiswa = await db.mahasiswa.count()
    const loginToday = await db.loginEvent.findMany({
      where: {
        type: 'login',
        timestamp: { gte: startOfToday },
      },
      select: { mahasiswaId: true },
      distinct: ['mahasiswaId'],
    })
    const sudahLogin = loginToday.length
    const belumLogin = totalMahasiswa - sudahLogin
    return NextResponse.json({
      data: {
        totalMahasiswa,
        sudahLogin,
        belumLogin,
        loginRate: totalMahasiswa > 0 ? (sudahLogin / totalMahasiswa) * 100 : 0,
      },
    })
  }

  if (action === 'belum-login-hari-ini') {
    const loginToday = await db.loginEvent.findMany({
      where: {
        type: 'login',
        timestamp: { gte: startOfToday },
      },
      select: { mahasiswaId: true },
      distinct: ['mahasiswaId'],
    })
    const loggedInIds = new Set(loginToday.map(l => l.mahasiswaId))
    const belumLogin = await db.mahasiswa.findMany({
      where: { id: { notIn: Array.from(loggedInIds) } },
      select: {
        id: true, nim: true, nama: true, wa: true,
        kamarId: true, kamar: { select: { nama: true } },
        isKetuaKamar: true,
      },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json({ data: belumLogin })
  }

  if (action === 'kamar-status') {
    const kamarId = searchParams.get('kamarId')
    if (!kamarId) {
      return NextResponse.json({ error: 'kamarId required' }, { status: 400 })
    }
    const kamar = await db.kamar.findUnique({
      where: { id: kamarId },
      include: {
        mahasiswa: {
          select: {
            id: true, nim: true, nama: true, wa: true, isKetuaKamar: true,
            loginEvents: {
              where: { type: 'login', timestamp: { gte: startOfToday } },
              take: 1,
              orderBy: { timestamp: 'desc' },
            },
          },
          orderBy: { nim: 'asc' },
        },
      },
    })
    if (!kamar) {
      return NextResponse.json({ error: 'Kamar tidak ditemukan' }, { status: 404 })
    }
    const anggota = kamar.mahasiswa.map(m => ({
      id: m.id, nim: m.nim, nama: m.nama, wa: m.wa,
      isKetuaKamar: m.isKetuaKamar,
      loginToday: m.loginEvents.length > 0,
      lastLogin: m.loginEvents[0]?.timestamp || null,
    }))
    return NextResponse.json({
      data: {
        kamar: { id: kamar.id, nama: kamar.nama, gender: kamar.gender, kapasitas: kamar.kapasitas },
        anggota,
      },
    })
  }

  if (action === 'belum-view-materi') {
    const materiId = searchParams.get('materiId')
    if (!materiId) {
      return NextResponse.json({ error: 'materiId required' }, { status: 400 })
    }
    const viewToday = await db.loginEvent.findMany({
      where: {
        type: 'view_materi',
        materiId,
        timestamp: { gte: startOfToday },
      },
      select: { mahasiswaId: true },
      distinct: ['mahasiswaId'],
    })
    const viewedIds = new Set(viewToday.map(v => v.mahasiswaId))
    const belumView = await db.mahasiswa.findMany({
      where: { id: { notIn: Array.from(viewedIds) } },
      select: {
        id: true, nim: true, nama: true, wa: true,
        kamar: { select: { nama: true } },
      },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json({ data: belumView })
  }

  if (action === 'belum-view-materi-hari-ini') {
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const materiToday = await db.materi.findMany({
      where: { tanggalRilis: { gte: startOfToday, lte: endOfToday } },
      select: { id: true, arabic: true, arti: true, jenis: true, kategori: true, tanggalRilis: true },
    })
    const result = await Promise.all(materiToday.map(async (m) => {
      const viewToday = await db.loginEvent.findMany({
        where: {
          type: 'view_materi',
          materiId: m.id,
          timestamp: { gte: startOfToday },
        },
        select: { mahasiswaId: true },
        distinct: ['mahasiswaId'],
      })
      const viewedIds = new Set(viewToday.map(v => v.mahasiswaId))
      const belumView = await db.mahasiswa.findMany({
        where: { id: { notIn: Array.from(viewedIds) } },
        select: {
          id: true, nim: true, nama: true, wa: true,
          kamar: { select: { nama: true } },
        },
        orderBy: { nama: 'asc' },
        take: 200,
      })
      return { materi: m, sudahView: viewToday.length, belumView }
    }))
    return NextResponse.json({ data: result })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const body = await req.json()

  if (action === 'view-materi') {
    const { mahasiswaId, materiId } = body
    if (!mahasiswaId || !materiId) {
      return NextResponse.json({ error: 'mahasiswaId dan materiId wajib' }, { status: 400 })
    }
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    // Hindari duplikat view event (kalau user refresh)
    const existing = await db.loginEvent.findFirst({
      where: {
        mahasiswaId, materiId,
        type: 'view_materi',
        timestamp: { gte: startOfToday },
      },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Sudah tercatat' })
    }
    await db.loginEvent.create({
      data: { mahasiswaId, materiId, type: 'view_materi' },
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
