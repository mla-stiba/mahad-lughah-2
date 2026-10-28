import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable } from '@/lib/cache'

// GET /api/materi-mahasiswa — materi yang sudah dirilis
// FIX #5: relax filter — tampilkan juga materi tanpa tanggalRilis (null = langsung rilis)
// FIX v3.0.5: return 2 lists: paket (with items) + materi lepas (paketId=null).
// Sebelumnya: flat list semua materi. User mau: paket muncul sebagai card dengan "Buka" button.
export async function GET(req: NextRequest) {
  const data = await cacheable('materi-mahasiswa', async () => {
  const now = new Date()
  const paketWhere = {
    OR: [
      { tanggalRilis: { lte: now } },
      { tanggalRilis: null },
    ],
  }
  // Fetch paket yang sudah rilis + include items (materi di dalam paket).
  const pakets = await db.paketMateri.findMany({
    where: paketWhere,
    include: {
      level: { select: { id: true, nama: true, nomor: true } },
      items: {
        // FIX v3.0.5: items yang sudah rilis (atau null tanggalRilis)
        where: {
          OR: [
            { tanggalRilis: { lte: now } },
            { tanggalRilis: null },
          ],
        },
        orderBy: [{ jenis: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true, arabic: true, arti: true, contoh: true, kategori: true,
          jenis: true, imageUrl: true, videoUrl: true, audioUrl: true,
          documentUrl: true, externalLink: true, socialEmbed: true,
          tanggalRilis: true, createdAt: true,
        },
      },
      _count: { select: { items: true } },
    },
    orderBy: [
      { tanggalRilis: 'desc' },
      { pekan: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  })

  // Fetch materi lepas (paketId=null) yang sudah rilis.
  const lepasMateri = await db.materi.findMany({
    where: {
      AND: [
        {
          OR: [
            { tanggalRilis: { lte: now } },
            { tanggalRilis: null },
          ],
        },
        { paketId: null },
      ],
    },
    include: { level: { select: { id: true, nama: true, nomor: true } } },
    orderBy: [
      { tanggalRilis: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  })

  return { pakets, lepas: lepasMateri }
  }, 300) // 5 min cache
  return NextResponse.json({ data })
}
