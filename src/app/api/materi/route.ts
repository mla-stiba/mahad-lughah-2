import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ MATERI API (OPTIMIZED) ============
// GET  /api/materi?levelId=&jenis=&paketId=lepas|<id>&take=100&skip=0
//      - paketId=lepas → hanya materi yang TIDAK ada di paket (paketId IS NULL)
//      - paketId=<id>  → hanya materi di paket tersebut
//      - paketId tidak diset → SEMUA materi (lepas + di paket)
// POST /api/materi  (create with media fields)
// PATCH /api/materi { id, ...fields }
// DELETE /api/materi?id=xxx        → hapus 1 materi
// DELETE /api/materi?action=delete-all-lepas → hapus SEMUA materi bebas (paketId IS NULL)
//
// OPTIMIZATION:
// - select: hanya ambil kolom yang dipakai view (exclude unused fields)
// - pagination: default 100 row, max 500 per request
// - include level.nama only

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const levelId = searchParams.get('levelId')
  const jenis = searchParams.get('jenis')
  const paketId = searchParams.get('paketId') // FIX v2.9.2: support filter "lepas"
  const take = Math.min(parseInt(searchParams.get('take') || '100'), 500)
  const skip = parseInt(searchParams.get('skip') || '0')

  const materi = await db.materi.findMany({
    where: {
      ...(levelId && levelId !== 'all' ? { levelId } : {}),
      ...(jenis && jenis !== 'all' ? { jenis } : {}),
      ...(paketId === 'lepas' ? { paketId: null } : (paketId && paketId !== 'all' ? { paketId } : {})),
    },
    select: {
      id: true,
      levelId: true,
      paketId: true, // FIX v2.9.2: kirim paketId ke client supaya bisa label "Lepas" / "di Paket X"
      jenis: true,
      arabic: true,
      arti: true,
      contoh: true,
      kategori: true,
      imageUrl: true,
      videoUrl: true,
      audioUrl: true,
      documentUrl: true,
      externalLink: true,
      socialEmbed: true,
      tanggalRilis: true,
      level: { select: { id: true, nama: true, nomor: true } },
    },
    orderBy: { kategori: 'asc' },
    take,
    skip,
  })
  return NextResponse.json({ data: materi })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.materi.create({
    data: {
      arabic: body.arabic,
      arti: body.arti,
      contoh: body.contoh || null,
      kategori: body.kategori || null,
      jenis: body.jenis,
      levelId: body.levelId,
      paketId: body.paketId || null,  // FIX #4: support paketId (kalau ada di paket)
      imageUrl: body.imageUrl || null,
      videoUrl: body.videoUrl || null,
      audioUrl: body.audioUrl || null,
      documentUrl: body.documentUrl || null,
      externalLink: body.externalLink || null,
      socialEmbed: body.socialEmbed || null,
      tanggalRilis: body.tanggalRilis ? new Date(body.tanggalRilis) : null,
    },
    select: { id: true, levelId: true, paketId: true, jenis: true, arabic: true, arti: true, level: { select: { id: true, nama: true } } },
  })
  return NextResponse.json({ data: created })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const updated = await db.materi.update({
    where: { id: body.id },
    data: {
      ...(body.arabic !== undefined && { arabic: body.arabic }),
      ...(body.arti !== undefined && { arti: body.arti }),
      ...(body.contoh !== undefined && { contoh: body.contoh }),
      ...(body.kategori !== undefined && { kategori: body.kategori }),
      ...(body.jenis !== undefined && { jenis: body.jenis }),
      ...(body.levelId !== undefined && { levelId: body.levelId }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
      ...(body.audioUrl !== undefined && { audioUrl: body.audioUrl }),
      ...(body.documentUrl !== undefined && { documentUrl: body.documentUrl }),
      ...(body.externalLink !== undefined && { externalLink: body.externalLink }),
      ...(body.socialEmbed !== undefined && { socialEmbed: body.socialEmbed }),
      ...(body.tanggalRilis !== undefined && { tanggalRilis: body.tanggalRilis ? new Date(body.tanggalRilis) : null }),
    },
    select: { id: true, levelId: true, jenis: true, arabic: true, arti: true, level: { select: { id: true, nama: true } } },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  // FIX v2.9.2: hapus SEMUA materi bebas (paketId IS NULL)
  // Berguna untuk cleanup batch — mis. mau hapus semua materi dummy / materi yang
  // tidak terkelompok di paket tertentu. Materi di dalam paket TIDAK terhapus.
  if (action === 'delete-all-lepas') {
    const result = await db.materi.deleteMany({
      where: { paketId: null },
    })
    return NextResponse.json({ success: true, deleted: result.count })
  }

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.materi.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
