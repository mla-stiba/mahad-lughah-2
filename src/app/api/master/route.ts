import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ MASTER DATA API (kamar, level) ============
// GET  /api/master?action=kamar
// GET  /api/master?action=level
// POST /api/master?action=kamar   { nama, gender, kapasitas }
// POST /api/master?action=level   { nomor, nama, deskripsi }
// DELETE /api/master?action=kamar&id=xxx
// DELETE /api/master?action=level&id=xxx

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // FIX: kamar-list untuk KegiatanView (hanya select id+nama+gender, no count)
  if (action === 'kamar-list') {
    const kamar = await db.kamar.findMany({
      select: { id: true, nama: true, gender: true, kapasitas: true },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json({ data: kamar })
  }

  if (action === 'kamar') {
    const kamar = await db.kamar.findMany({
      include: { _count: { select: { mahasiswa: true } } },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json({ data: kamar })
  }

  if (action === 'level') {
    const level = await db.level.findMany({
      include: { _count: { select: { materi: true, sesi: true } } },
      orderBy: { nomor: 'asc' },
    })
    return NextResponse.json({ data: level })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const body = await req.json()

  if (action === 'kamar') {
    const created = await db.kamar.create({
      data: { nama: body.nama, gender: body.gender || 'putra', kapasitas: body.kapasitas || 8 },
      include: { _count: { select: { mahasiswa: true } } },
    })
    return NextResponse.json({ data: created })
  }

  if (action === 'level') {
    const created = await db.level.create({
      data: { nomor: body.nomor, nama: body.nama, deskripsi: body.deskripsi || null },
      include: { _count: { select: { materi: true, sesi: true } } },
    })
    return NextResponse.json({ data: created })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  if (action === 'kamar') {
    await db.kamar.delete({ where: { id } })
    return NextResponse.json({ success: true })
  }
  if (action === 'level') {
    await db.level.delete({ where: { id } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
