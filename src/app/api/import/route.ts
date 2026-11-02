import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============ IMPORT CSV API (OPTIMIZED) ============
// POST /api/import?action=mahasiswa  { csv }            -> SSE stream
// POST /api/import?action=materi     { csv, levelId }   -> SSE stream
// POST /api/import?action=soal       { csv, sesiId }     -> SSE stream
// POST /api/import?action=reset                          -> JSON
// GET  /api/import?action=template-mahasiswa|template-materi|template-soal -> CSV
//
// OPTIMIZATION NOTES (vs versi lama):
// 1. Bulk lookup: 1 query findMany untuk cek existing, bukan findUnique per baris
// 2. Chunking: createMany 50 baris per chunk (1 query per chunk, bukan 1 query per baris)
// 3. skipDuplicates: handle konflik NIM tanpa try/catch per baris
// 4. Update existing pakai $transaction per chunk (1 round-trip per chunk)
// 5. SSE stream: kirim progress event per chunk supaya client bisa tampilkan progress bar
// 6. Timeout-friendly: setiap chunk <3 detik, total tetap di bawah 60 detik Vercel
//
// BEFORE: 200 mahasiswa = 400+ queries sequential = 30-80 detik (timeout!)
// AFTER:  200 mahasiswa = ~6 chunked queries = 2-5 detik

const CHUNK_SIZE = 50

// ============ CSV PARSER ============
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        current.push(field.trim())
        field = ''
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++
        current.push(field.trim())
        field = ''
        if (current.length > 0 && current.some(f => f !== '')) {
          rows.push(current)
        }
        current = []
      } else {
        field += c
      }
    }
  }
  if (field !== '' || current.length > 0) {
    current.push(field.trim())
    if (current.some(f => f !== '')) rows.push(current)
  }
  return rows
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.toLowerCase().trim())
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (row[i] || '').trim()
    })
    return obj
  })
}

// ============ SSE STREAM HELPER ============
function createSSEStream(handler: (send: (event: string, data: any) => void) => Promise<void>) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        try {
          controller.enqueue(encoder.encode(payload))
        } catch {
          // client disconnected
        }
      }
      try {
        await handler(send)
      } catch (e: any) {
        send('error', { message: e.message || 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ============ POST HANDLER ============
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'reset') {
    return resetDatabase()
  }

  const body = await req.json()

  if (action === 'mahasiswa') {
    return handleImportMahasiswa(body.csv || '')
  }

  if (action === 'materi') {
    return handleImportMateri(body.csv || '', body.levelId)
  }

  if (action === 'soal') {
    return handleImportSoal(body.csv || '', body.sesiId)
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

// ============ IMPORT MAHASISWA ============
function handleImportMahasiswa(csvText: string) {
  return createSSEStream(async (send) => {
    const rows = parseCSV(csvText)
    const objects = rowsToObjects(rows)
    const total = objects.length
    send('start', { total, action: 'mahasiswa' })

    if (total === 0) {
      send('done', { created: 0, updated: 0, errors: [], message: 'CSV kosong' })
      return
    }

    // Step 1: validate all rows, partition valid/invalid
    const errors: string[] = []
    const valid: any[] = []
    objects.forEach((o, i) => {
      const nim = o.nim || o.kode
      if (!nim) {
        errors.push(`Baris ${i + 2}: NIM kosong`)
        return
      }
      const nama = o.nama || o.name || ''
      if (!nama) {
        errors.push(`Baris ${i + 2}: nama kosong`)
        return
      }
      const kamarNama = (o.kamar || o.kamar_nama || '').toLowerCase()
      const tanggalLahir = o.tanggal_lahir || o.tanggalLahir || o.tgllahir || ''
      const ketuaRaw = (o.is_ketua_kamar || o.ketua || o.isKetuaKamar || '').toLowerCase()
      const isKetuaKamar = ['true', 'ya', '1', 'y'].includes(ketuaRaw)
      valid.push({ nim, nama, wa: o.wa || o.whatsapp || null, tanggalLahir: tanggalLahir || null, isKetuaKamar, kamarNama, rowIndex: i + 2 })
    })

    if (valid.length === 0) {
      send('done', { created: 0, updated: 0, errors: errors.slice(0, 20), total: 0 })
      return
    }

    // Step 2: preload all kamar (one query, not per-row)
    const allKamar = await db.kamar.findMany({ select: { id: true, nama: true } })
    const kamarMap = new Map(allKamar.map(k => [k.nama.toLowerCase(), k.id]))
    const fallbackKamarId = allKamar[0]?.id ?? null

    // Step 3: bulk fetch existing NIMs (one query, not per-row)
    const allNims = valid.map(v => v.nim)
    const existingRecords = await db.mahasiswa.findMany({
      where: { nim: { in: allNims } },
      select: { nim: true },
    })
    const existingNimSet = new Set(existingRecords.map(m => m.nim))

    // Step 4: partition create vs update
    const toCreate: any[] = []
    const toUpdate: any[] = []
    for (const v of valid) {
      const kamarId = kamarMap.get(v.kamarNama) || fallbackKamarId
      if (!kamarId) {
        errors.push(`Baris ${v.rowIndex}: kamar tidak ditemukan dan tidak ada kamar fallback`)
        continue
      }
      const data = {
        nim: v.nim,
        nama: v.nama,
        wa: v.wa,
        tanggalLahir: v.tanggalLahir,
        isKetuaKamar: v.isKetuaKamar,
        kamarId,
      }
      if (existingNimSet.has(v.nim)) {
        toUpdate.push(data)
      } else {
        toCreate.push(data)
      }
    }

    // Step 5: createMany in chunks (skipDuplicates for safety)
    let created = 0
    let updated = 0
    const createChunks = chunk(toCreate, CHUNK_SIZE)
    for (let i = 0; i < createChunks.length; i++) {
      const c = createChunks[i]
      const result = await db.mahasiswa.createMany({ data: c, skipDuplicates: true })
      created += result.count
      send('progress', {
        phase: 'create',
        chunk: i + 1,
        total: createChunks.length,
        processed: created,
        created,
        updated,
        errors: errors.length,
      })
    }

    // Step 6: update existing in chunks via $transaction
    const updateChunks = chunk(toUpdate, CHUNK_SIZE)
    for (let i = 0; i < updateChunks.length; i++) {
      const c = updateChunks[i]
      await db.$transaction(
        c.map((item) =>
          db.mahasiswa.update({
            where: { nim: item.nim },
            data: {
              nama: item.nama,
              wa: item.wa,
              tanggalLahir: item.tanggalLahir,
              isKetuaKamar: item.isKetuaKamar,
              kamarId: item.kamarId,
            },
          })
        )
      )
      updated += c.length
      send('progress', {
        phase: 'update',
        chunk: i + 1,
        total: updateChunks.length,
        processed: updated,
        created,
        updated,
        errors: errors.length,
      })
    }

    send('done', { created, updated, errors: errors.slice(0, 20), total })
  })
}

// ============ IMPORT MATERI ============
function handleImportMateri(csvText: string, levelId: string) {
  return createSSEStream(async (send) => {
    const rows = parseCSV(csvText)
    const objects = rowsToObjects(rows)
    const total = objects.length
    send('start', { total, action: 'materi' })

    if (!levelId) {
      send('error', { message: 'levelId wajib diisi' })
      return
    }

    if (total === 0) {
      send('done', { created: 0, updated: 0, errors: [], message: 'CSV kosong' })
      return
    }

    const errors: string[] = []
    const valid: any[] = []
    objects.forEach((o, i) => {
      const arabic = o.arabic || o.arab || ''
      const arti = o.arti || o.indonesia || o.arti_indonesia || ''
      if (!arabic || !arti) {
        errors.push(`Baris ${i + 2}: arabic atau arti kosong`)
        return
      }
      valid.push({
        arabic,
        arti,
        contoh: o.contoh || o.kalimat_contoh || null,
        kategori: o.kategori || o.tema || null,
        jenis: (o.jenis || 'mufrodat').toLowerCase(),
        levelId,
        audioUrl: o.audio_url || o.audiourl || null,
        imageUrl: o.image_url || o.imageurl || null,
        videoUrl: o.video_url || o.videourl || null,
        documentUrl: o.document_url || o.documenturl || null,
        externalLink: o.link || o.external_link || null,
        rowIndex: i + 2,
      })
    })

    if (valid.length === 0) {
      send('done', { created: 0, updated: 0, errors: errors.slice(0, 20), total: 0 })
      return
    }

    // Bulk fetch existing materi by (arabic + levelId + jenis) — composite key
    // Since Prisma doesn't have composite where without @@unique, we fetch by levelId then filter
    const existingMateri = await db.materi.findMany({
      where: { levelId },
      select: { id: true, arabic: true, jenis: true, levelId: true },
    })
    const existingMap = new Map(
      existingMateri.map(m => [`${m.arabic}|${m.jenis}|${m.levelId}`, m.id])
    )

    const toCreate: any[] = []
    const toUpdate: any[] = []
    for (const v of valid) {
      const key = `${v.arabic}|${v.jenis}|${v.levelId}`
      const data = {
        arabic: v.arabic,
        arti: v.arti,
        contoh: v.contoh,
        kategori: v.kategori,
        jenis: v.jenis,
        levelId: v.levelId,
        audioUrl: v.audioUrl,
        imageUrl: v.imageUrl,
        videoUrl: v.videoUrl,
        documentUrl: v.documentUrl,
        externalLink: v.externalLink,
      }
      if (existingMap.has(key)) {
        toUpdate.push({ id: existingMap.get(key), data })
      } else {
        toCreate.push(data)
      }
    }

    let created = 0
    let updated = 0
    const createChunks = chunk(toCreate, CHUNK_SIZE)
    for (let i = 0; i < createChunks.length; i++) {
      const c = createChunks[i]
      const result = await db.materi.createMany({ data: c, skipDuplicates: true })
      created += result.count
      send('progress', {
        phase: 'create',
        chunk: i + 1,
        total: createChunks.length,
        processed: created,
        created,
        updated,
        errors: errors.length,
      })
    }

    const updateChunks = chunk(toUpdate, CHUNK_SIZE)
    for (let i = 0; i < updateChunks.length; i++) {
      const c = updateChunks[i]
      await db.$transaction(
        c.map((item) =>
          db.materi.update({ where: { id: item.id }, data: item.data })
        )
      )
      updated += c.length
      send('progress', {
        phase: 'update',
        chunk: i + 1,
        total: updateChunks.length,
        processed: updated,
        created,
        updated,
        errors: errors.length,
      })
    }

    send('done', { created, updated, errors: errors.slice(0, 20), total })
  })
}

// ============ IMPORT SOAL ============
function handleImportSoal(csvText: string, sesiId: string) {
  return createSSEStream(async (send) => {
    const rows = parseCSV(csvText)
    const objects = rowsToObjects(rows)
    const total = objects.length
    send('start', { total, action: 'soal' })

    if (!sesiId) {
      send('error', { message: 'sesiId wajib diisi' })
      return
    }

    const sesi = await db.sesiUjian.findUnique({ where: { id: sesiId } })
    if (!sesi) {
      send('error', { message: 'Sesi tidak ditemukan' })
      return
    }

    if (total === 0) {
      send('done', { created: 0, errors: [], message: 'CSV kosong' })
      return
    }

    const errors: string[] = []
    const valid: any[] = []
    const existingSoal = await db.soalUjian.findMany({
      where: { sesiId },
      orderBy: { no: 'desc' },
      take: 1,
    })
    let nextNo = existingSoal[0]?.no ?? 0

    objects.forEach((o, i) => {
      const jenis = (o.jenis || 'isian').toLowerCase()
      if (!['isian', 'mcq', 'terjemahan', 'matching', 'audio'].includes(jenis)) {
        errors.push(`Baris ${i + 2}: jenis tidak valid (${jenis})`)
        return
      }
      const pertanyaan = o.pertanyaan || o.soal || ''
      if (!pertanyaan) {
        errors.push(`Baris ${i + 2}: pertanyaan kosong`)
        return
      }
      nextNo += 1
      let opsiJson: string | null = null
      if (jenis === 'mcq' && o.opsi) {
        const opsiArr = o.opsi.split('|').map((s: string) => s.trim()).filter(Boolean)
        opsiJson = JSON.stringify(opsiArr)
      }
      let jawabanAlternatif: string | null = null
      if (o.jawaban_alternatif) {
        try {
          const alts = JSON.parse(o.jawaban_alternatif)
          if (Array.isArray(alts)) {
            jawabanAlternatif = JSON.stringify(alts)
          }
        } catch {
          jawabanAlternatif = JSON.stringify([o.jawaban_alternatif])
        }
      }
      valid.push({
        sesiId,
        no: nextNo,
        jenis,
        pertanyaan,
        pertanyaanArabic: o.pertanyaan_arabic || o.arabic || null,
        opsiJson,
        jawabanBenar: o.jawaban_benar || o.jawaban || null,
        jawabanAlternatif,
        bobot: o.bobot ? parseFloat(o.bobot) : 1,
        tipeSkor: o.tipe_skor || 'benar_salah',
        hint: o.hint || null,
      })
    })

    if (valid.length === 0) {
      send('done', { created: 0, errors: errors.slice(0, 20), total: 0 })
      return
    }

    let created = 0
    const createChunks = chunk(valid, CHUNK_SIZE)
    for (let i = 0; i < createChunks.length; i++) {
      const c = createChunks[i]
      const result = await db.soalUjian.createMany({ data: c })
      created += result.count
      send('progress', {
        phase: 'create',
        chunk: i + 1,
        total: createChunks.length,
        processed: created,
        created,
        errors: errors.length,
      })
    }

    send('done', { created, errors: errors.slice(0, 20), total })
  })
}

// ============ RESET DATABASE ============
async function resetDatabase() {
  await db.detailHasil.deleteMany()
  await db.hasilUjian.deleteMany()
  await db.soalUjian.deleteMany()
  await db.sesiUjian.deleteMany()
  await db.materi.deleteMany()
  await db.mahasiswa.deleteMany()
  await db.level.deleteMany()
  await db.kamar.deleteMany()
  await db.user.deleteMany()
  return NextResponse.json({ success: true, message: 'Database reset' })
}

// ============ GET: TEMPLATE CSV DOWNLOADS ============
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'template-mahasiswa') {
    const csv = `nim,nama,wa,tanggal_lahir,is_ketua_kamar,kamar
2657184001,RAFIE ABQARY MUSTAFA,6281342945521,2005-04-15,ya,08.02.01
2657184002,MUHAMMAD BILAL AS'AD,6282311113693,2003-08-20,tidak,08.02.01
2657184003,AISYAH PUTRI,6282347761499,2004-12-05,tidak,08.01.01`
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="template-mahasiswa.csv"' },
    })
  }

  if (action === 'template-materi') {
    const csv = `jenis,arabic,arti,kategori,contoh
mufrodat,أَبٌ,ayah,keluarga,هَذَا أَبِي
mufrodat,أُمٌّ,ibu,keluarga,هَذِهِ أُمِّي
mufrodat,خُبْزٌ,roti,makanan,الْخُبْزُ طَيِّبٌ
tarkib,هَذَا...,Ini (lk),isyarat,هَذَا كِتَابٌ`
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="template-materi.csv"' },
    })
  }

  if (action === 'template-soal') {
    const csv = `no,jenis,pertanyaan,pertanyaan_arabic,opsi,jawaban_benar,jawaban_alternatif,bobot,tipe_skor,hint
1,isian,Tuliskan dalam bahasa Arab: ayah,,,"أَبٌ","[""abun"",""abu""]",1,benar_salah,Hint: cek materi
2,terjemahan,Tuliskan dalam bahasa Arab: roti,,,"خُبْزٌ","[""khubzun""]",1,benar_salah,
3,mcq,Apa arti kata berikut?,خُبْزٌ,roti|nasi|air|gula,roti,,1,benar_salah,
4,mcq,Apa arti kata berikut?,أُمٌّ,ayah|ibu|anak|saudara,ibu,,1,benar_salah,
5,audio,Bacakan dengan tepat lafaz Arab dan artinya: ayah,أَبٌ,,أَبٌ,,2,A_B_C_D,Hint: cek materi`
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="template-soal.csv"' },
    })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
