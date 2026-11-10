import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ MAHASISWA API (OPTIMIZED) ============
// GET  /api/mahasiswa?kamarId=&take=500&skip=0
// GET  /api/mahasiswa?lookup-by-nim=NIM
// POST /api/mahasiswa  { nim, nama, wa, isKetuaKamar, kamarId }
// PATCH /api/mahasiswa  { id, ...fields }
// DELETE /api/mahasiswa?id=xxx
//
// OPTIMIZATION:
// - select: hanya ambil kolom yang dibutuhkan frontend (exclude tanggalLahir yang sensitif)
// - pagination: default take=500 (cukup untuk semua mahasiswa Ma'had Lughah ~225),
//   max 2000 (untuk antisipasi pertumbuhan ke pesantren besar)
// - include kamar.nama only (not full Kamar row)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const kamarId = searchParams.get('kamarId')
  const lookupNim = searchParams.get('lookup-by-nim')
  // FIX v2.9.1: default take 100 → 500 (cukup untuk semua mahasiswa Ma'had Lughah saat "Semua Kamar" dipilih).
  // Max cap 2000 (antisipasi pesantren besar di masa depan). Tanpa fix ini, hanya 100 mahasiswa pertama muncul.
  const take = Math.min(parseInt(searchParams.get('take') || '500'), 2000)
  const skip = parseInt(searchParams.get('skip') || '0')

  // Fast NIM lookup untuk login auto-suggest
  if (lookupNim) {
    const mhs = await db.mahasiswa.findUnique({
      where: { nim: lookupNim },
      select: { id: true, nim: true, nama: true, isKetuaKamar: true, kamarId: true, kamar: { select: { nama: true } } },
    })
    return NextResponse.json({ data: mhs }) // null kalau tidak ditemukan
  }

  const mhs = await db.mahasiswa.findMany({
    where: {
      ...(kamarId && kamarId !== 'all' ? { kamarId } : {}),
    },
    select: {
      id: true,
      nim: true,
      nama: true,
      wa: true,
      tanggalLahir: true, // dipakai untuk form edit + password hint
      isKetuaKamar: true,
      kamarId: true,
      kamar: { select: { nama: true, gender: true } },
    },
    // FIX v2.9.2: urutkan per kamar dulu (08.01.01 → 08.01.02 → 08.02.01 → ... → 08.04.16),
    // baru urutkan per NIM di dalam kamar yang sama. Sebelumnya hanya orderBy nim:asc
    // yang bikin mahasiswa dari kamar berbeda tercampur.
    orderBy: [
      { kamar: { nama: 'asc' } },
      { nim: 'asc' },
    ],
    take,
    skip,
  })
  return NextResponse.json({ data: mhs })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.mahasiswa.create({
    data: {
      nim: body.nim,
      nama: body.nama,
      wa: body.wa || null,
      tanggalLahir: body.tanggalLahir || null,
      isKetuaKamar: body.isKetuaKamar ?? false,
      kamarId: body.kamarId,
    },
    select: { id: true, nim: true, nama: true, wa: true, isKetuaKamar: true, kamarId: true, kamar: { select: { nama: true } } },
  })
  return NextResponse.json({ data: created })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const updated = await db.mahasiswa.update({
    where: { id: body.id },
    data: {
      ...(body.nama !== undefined && { nama: body.nama }),
      ...(body.nim !== undefined && { nim: body.nim }),
      ...(body.wa !== undefined && { wa: body.wa || null }),
      ...(body.tanggalLahir !== undefined && { tanggalLahir: body.tanggalLahir || null }),
      ...(body.isKetuaKamar !== undefined && { isKetuaKamar: body.isKetuaKamar }),
      ...(body.kamarId !== undefined && { kamarId: body.kamarId }),
    },
    select: { id: true, nim: true, nama: true, wa: true, isKetuaKamar: true, kamarId: true, kamar: { select: { nama: true } } },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.mahasiswa.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
