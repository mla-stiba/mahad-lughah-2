import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ HAFALAN TRACKING API ============
// GET  /api/hafalan?kamarId=xxx&levelId=yyy
//      -> { data: [{ mahasiswa, materi, status, centangBy, catatan, updatedAt }] }
// POST /api/hafalan { mahasiswaId, materiId, status, centangBy, catatan? }
//      -> upsert tracking record

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kamarId = searchParams.get('kamarId')
  const levelId = searchParams.get('levelId')
  const mahasiswaId = searchParams.get('mahasiswaId')

  const now = new Date()
  // FIX: include materi dengan tanggalRilis null (materi di paket biasanya gak punya tanggalRilis sendiri)
  const materiWhere: any = {
    OR: [
      { tanggalRilis: { lte: now } },
      { tanggalRilis: null },
    ],
  }
  if (levelId && levelId !== 'all') {
    materiWhere.levelId = levelId
  }
  // FIX #2 user: support filter paketId (untuk filter mufrodat per paket)
  const paketId = searchParams.get('paketId')
  if (paketId && paketId !== 'all') {
    materiWhere.paketId = paketId
  }
  const materiList = await db.materi.findMany({
    where: materiWhere,
    select: {
      id: true, arabic: true, arti: true, jenis: true, kategori: true,
      levelId: true, level: { select: { id: true, nama: true, nomor: true } },
      tanggalRilis: true,
    },
    orderBy: { tanggalRilis: 'desc' },
    // FIX v3.0.3: take 100 → 500. User report ada 115+ materi tapi yang tampil hanya 100
    // (15+ materi terpotong). Bump ke 500 untuk akomodasi pertumbuhan ke depan.
    take: 500,
  })

  const mhsWhere: any = {}
  if (kamarId && kamarId !== 'all') {
    mhsWhere.kamarId = kamarId
  }
  if (mahasiswaId) {
    mhsWhere.id = mahasiswaId
  }
  const anggota = await db.mahasiswa.findMany({
    where: mhsWhere,
    select: {
      id: true, nim: true, nama: true, isKetuaKamar: true,
      kamar: { select: { id: true, nama: true } },
    },
    orderBy: { nama: 'asc' },
    take: 200,
  })

  const mhsIds = anggota.map(a => a.id)
  const materiIds = materiList.map(m => m.id)
  const tracking = await db.hafalanTracking.findMany({
    where: {
      mahasiswaId: { in: mhsIds },
      materiId: { in: materiIds },
    },
    select: {
      mahasiswaId: true, materiId: true, status: true,
      centangBy: true, catatan: true, updatedAt: true,
    },
  })

  const trackingMap = new Map(
    tracking.map(t => [`${t.mahasiswaId}|${t.materiId}`, t])
  )

  const grid = anggota.map(a => ({
    mahasiswa: a,
    materi: materiList.map(m => ({
      materi: m,
      status: trackingMap.get(`${a.id}|${m.id}`)?.status || 'belum',
      centangBy: trackingMap.get(`${a.id}|${m.id}`)?.centangBy || null,
      catatan: trackingMap.get(`${a.id}|${m.id}`)?.catatan || null,
      updatedAt: trackingMap.get(`${a.id}|${m.id}`)?.updatedAt || null,
    })),
  }))

  return NextResponse.json({ data: grid, materiList, anggota })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mahasiswaId, materiId, status, centangBy, catatan } = body

  if (!mahasiswaId || !materiId || !status) {
    return NextResponse.json({ error: 'mahasiswaId, materiId, status wajib' }, { status: 400 })
  }

  if (!['belum', 'hafal', 'jumlah'].includes(status)) {
    return NextResponse.json({ error: 'status tidak valid (belum|hafal|jumlah)' }, { status: 400 })
  }

  const result = await db.hafalanTracking.upsert({
    where: {
      mahasiswaId_materiId: { mahasiswaId, materiId },
    },
    update: {
      status,
      centangBy: centangBy || null,
      catatan: catatan || null,
    },
    create: {
      mahasiswaId, materiId, status,
      centangBy: centangBy || null,
      catatan: catatan || null,
    },
  })

  return NextResponse.json({ data: result })
}
