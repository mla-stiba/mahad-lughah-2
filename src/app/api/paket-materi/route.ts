import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ PAKET MATERI API (FIX #4) ============
// GET  /api/paket-materi?levelId=&action=available
//      -> list paket (yang sudah rilis untuk mahasiswa)
// GET  /api/paket-materi?levelId= (default, admin)
//      -> list semua paket
// GET  /api/paket-materi?id=xxx
//      -> detail paket + items
// POST /api/paket-materi { nama, levelId, tema, pekan, deskripsi, imageUrl, tanggalRilis, items? }
//      -> create paket (kalau items ada, auto-create juga)
// PATCH /api/paket-materi { id, ...fields }
//      -> update paket
// DELETE /api/paket-materi?id=xxx
//      -> delete paket (items akan punya paketId=null)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const levelId = searchParams.get('levelId')
  const paketId = searchParams.get('id')
  const now = new Date()

  // Detail paket + items (untuk admin edit / mahasiswa lihat)
  if (paketId) {
    const paket = await db.paketMateri.findUnique({
      where: { id: paketId },
      include: {
        level: { select: { id: true, nama: true, nomor: true } },
        items: {
          orderBy: [{ jenis: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true, arabic: true, arti: true, contoh: true, kategori: true,
            jenis: true, imageUrl: true, videoUrl: true, audioUrl: true,
            documentUrl: true, externalLink: true, socialEmbed: true,
            tanggalRilis: true, createdAt: true,
          },
        },
      },
    })
    if (!paket) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ data: paket })
  }

  // Untuk mahasiswa: list paket yang sudah rilis
  const where: any = {}
  if (levelId && levelId !== 'all') where.levelId = levelId
  if (action === 'available') {
    where.OR = [
      { tanggalRilis: { lte: now } },
      { tanggalRilis: null },
    ]
  }

  const pakets = await db.paketMateri.findMany({
    where,
    include: {
      level: { select: { id: true, nama: true, nomor: true } },
      _count: { select: { items: true } },
    },
    orderBy: [
      { tanggalRilis: 'desc' },
      { pekan: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  })

  return NextResponse.json({ data: pakets })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // ====== ACTION: generate-from-script (batch-import materi ke paket) ======
  // FIX script-format-materi-berpaket: paralel dengan generator soal di /api/sesi.
  // Format script (rich text friendly):
  //   ## [mufrodat]            ← mulai block, jenis wajib (mufrodat | tarkib)
  //   arabic: أَبٌ              ← teks Arab (wajib)
  //   arti: ayah               ← terjemahan (wajib)
  //   contoh: هَذَا أَبِي         ← contoh kalimat (opsional)
  //   kategori: keluarga        ← kategori/tema (opsional)
  //   audio: https://...mp3    ← URL audio (opsional)
  //   gambar: https://...jpg   ← URL gambar (opsional)
  //   video: https://...mp4    ← URL video (opsional)
  //   ---
  //   ## [tarkib]
  //   arabic: الْكِتَابُ مَفْتُوحٌ
  //   arti: buku terbuka
  if (body.action === 'generate-from-script') {
    const { paketId, script } = body
    if (!paketId || !script) {
      return NextResponse.json({ error: 'paketId dan script required' }, { status: 400 })
    }
    const paket = await db.paketMateri.findUnique({ where: { id: paketId } })
    if (!paket) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 404 })

    const blocks = String(script).split(/^##\s*/m).filter((b: string) => b.trim())
    let created = 0
    const errors: string[] = []
    const items: any[] = []

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx]
      try {
        const lines = block.split('\n')
        const firstLine = (lines[0] || '').trim()
        const jenisMatch = firstLine.match(/\[(mufrodat|tarkib)\]/i)
          || firstLine.match(/(mufrodat|tarkib)/i)
        if (!jenisMatch) {
          errors.push(`Block ${blockIdx + 1}: jenis tidak ditemukan (pakai "## [mufrodat]" atau "## [tarkib]")`)
          continue
        }
        const jenis = jenisMatch[1].toLowerCase()

        const data: Record<string, string> = {}
        for (let i = 1; i < lines.length; i++) {
          const trimmed = lines[i].trim()
          if (!trimmed || trimmed === '---') continue
          const colonIdx = trimmed.indexOf(':')
          if (colonIdx > 0 && !trimmed.match(/^<|^\s*-/)) {
            const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
            const val = trimmed.substring(colonIdx + 1).trim()
            if ([
              'arabic', 'ar', 'arti', 'id', 'contoh', 'kategori', 'tema',
              'audio', 'audiourl', 'gambar', 'image', 'imageurl',
              'video', 'videourl', 'dokumen', 'document', 'documenturl',
              'link', 'linkurl', 'external', 'externalurl',
            ].includes(key)) {
              data[key] = val
              continue
            }
          }
        }

        const arabic = data['arabic'] || data['ar'] || ''
        const arti = data['arti'] || data['id'] || ''
        if (!arabic || !arti) {
          errors.push(`Block ${blockIdx + 1}: arabic + arti wajib diisi`)
          continue
        }

        items.push({
          levelId: paket.levelId,
          paketId: paket.id,
          jenis,
          arabic,
          arti,
          contoh: data['contoh'] || null,
          kategori: data['kategori'] || data['tema'] || null,
          audioUrl: data['audio'] || data['audiourl'] || null,
          imageUrl: data['gambar'] || data['image'] || data['imageurl'] || null,
          videoUrl: data['video'] || data['videourl'] || null,
          documentUrl: data['dokumen'] || data['document'] || data['documenturl'] || null,
          externalLink: data['link'] || data['external'] || null,
        })
      } catch (e: any) {
        errors.push(`Block ${blockIdx + 1}: ${e.message}`)
      }
    }

    if (items.length > 0) {
      const r = await db.materi.createMany({ data: items })
      created = r.count
    }
    return NextResponse.json({ success: true, created, errors: errors.slice(0, 10) })
  }

  // Validasi
  if (!body.nama || !body.levelId) {
    return NextResponse.json({ error: 'nama dan levelId wajib' }, { status: 400 })
  }

  // Create paket
  const created = await db.paketMateri.create({
    data: {
      nama: body.nama,
      levelId: body.levelId,
      tema: body.tema || null,
      pekan: body.pekan ? parseInt(body.pekan) : null,
      kategori: body.kategori || null,
      deskripsi: body.deskripsi || null,
      imageUrl: body.imageUrl || null,
      tanggalRilis: body.tanggalRilis ? new Date(body.tanggalRilis) : null,
    },
    include: { level: { select: { id: true, nama: true } } },
  })

  // Kalau body.items ada (array of mufrodat/uslub), auto-create
  if (Array.isArray(body.items) && body.items.length > 0) {
    await db.materi.createMany({
      data: body.items.map((item: any) => ({
        levelId: body.levelId,
        paketId: created.id,
        jenis: item.jenis || 'mufrodat',
        arabic: item.arabic,
        arti: item.arti,
        contoh: item.contoh || null,
        kategori: item.kategori || null,
        imageUrl: item.imageUrl || null,
        videoUrl: item.videoUrl || null,
        audioUrl: item.audioUrl || null,
        documentUrl: item.documentUrl || null,
        externalLink: item.externalLink || null,
      })),
    })
  }

  return NextResponse.json({ data: created })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'id wajib' }, { status: 400 })
  }

  const updated = await db.paketMateri.update({
    where: { id: body.id },
    data: {
      ...(body.nama !== undefined && { nama: body.nama }),
      ...(body.levelId !== undefined && { levelId: body.levelId }),
      ...(body.tema !== undefined && { tema: body.tema || null }),
      ...(body.pekan !== undefined && { pekan: body.pekan ? parseInt(body.pekan) : null }),
      ...(body.kategori !== undefined && { kategori: body.kategori || null }),
      ...(body.deskripsi !== undefined && { deskripsi: body.deskripsi || null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
      ...(body.tanggalRilis !== undefined && { tanggalRilis: body.tanggalRilis ? new Date(body.tanggalRilis) : null }),
    },
    include: { level: { select: { id: true, nama: true } } },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Delete paket — items akan jadi materi lepas (paketId=null)
  await db.paketMateri.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
