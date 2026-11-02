import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ SESI UJIAN + SOAL API ============
// GET  /api/sesi?levelId=&aktif=
// GET  /api/sesi?id=xxx   (detail dengan soal)
// POST /api/sesi          (create new)
// PATCH /api/sesi
// DELETE /api/sesi?id=xxx

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const levelId = searchParams.get('levelId')
  const aktif = searchParams.get('aktif')
  const action = searchParams.get('action')

  // FIX #5: GET list mahasiswa yang belum kerja ujian tertentu (untuk admin copy nama)
  if (action === 'belum-kerja' && id) {
    // Ambil semua hasil di sesi ini, lalu ambil semua mahasiswa, filter yang belum ada hasil
    const hasilList = await db.hasilUjian.findMany({
      where: { sesiId: id },
      select: { mahasiswaId: true },
    })
    const sudahKerjaIds = new Set(hasilList.map(h => h.mahasiswaId))
    const belumKerja = await db.mahasiswa.findMany({
      where: { id: { notIn: Array.from(sudahKerjaIds) } },
      select: {
        id: true, nim: true, nama: true,
        kamar: { select: { nama: true } },
      },
      orderBy: { nama: 'asc' },
    })
    return NextResponse.json({ data: belumKerja })
  }

  if (id) {
    const sesi = await db.sesiUjian.findUnique({
      where: { id },
      include: {
        level: true,
        soal: { orderBy: { no: 'asc' }, include: { materi: true } },
        hasil: { include: { mahasiswa: { include: { kamar: true } } } },
      },
    })
    if (!sesi) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: sesi })
  }

  const sesiList = await db.sesiUjian.findMany({
    where: {
      ...(levelId && levelId !== 'all' ? { levelId } : {}),
      ...(aktif === 'true' ? { aktif: true } : aktif === 'false' ? { aktif: false } : {}),
    },
    select: {
      id: true, nama: true, levelId: true, mode: true, durasiMenit: true,
      tanggalMulai: true, jamMulai: true, jamSelesai: true, aktif: true,
      acakUrutan: true, jumlahSoalPerMahasiswa: true, gunakanFase: true,
      level: { select: { id: true, nama: true } },
      _count: { select: { soal: true, hasil: true } },
    },
    orderBy: { tanggalMulai: 'desc' },
    take: 50,
  })
  return NextResponse.json({ data: sesiList })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.action === 'add-soal') {
    const soal = await db.soalUjian.create({
      data: {
        sesiId: body.sesiId,
        no: body.no,
        jenis: body.jenis,
        materiId: body.materiId || null,
        pertanyaan: body.pertanyaan,
        pertanyaanArabic: body.pertanyaanArabic || null,
        opsiJson: body.opsiJson || null,
        jawabanBenar: body.jawabanBenar || null,
        jawabanAlternatif: body.jawabanAlternatif || null,
        audioUrl: body.audioUrl || null,
        imageUrl: body.imageUrl || null,
        videoUrl: body.videoUrl || null,
        embedUrl: body.embedUrl || null,
        fase: body.fase || null,
        kategori: body.kategori || null,
        bobot: body.bobot ?? 1,
        tipeSkor: body.tipeSkor || 'benar_salah',
        hint: body.hint || null,
        // FIX v3.0.7 #6: support isAudio flag
        isAudio: body.isAudio ?? false,
        // FIX v3.0.7 #7: support pairsJson untuk sambung soal
        pairsJson: body.pairsJson || null,
      },
    })
    return NextResponse.json({ data: soal })
  }

  if (body.action === 'delete-soal') {
    await db.soalUjian.delete({ where: { id: body.soalId } })
    return NextResponse.json({ success: true })
  }

  if (body.action === 'update-soal') {
    // Update soal yang sudah ada (manual edit)
    const soal = await db.soalUjian.update({
      where: { id: body.soalId },
      data: {
        ...(body.jenis !== undefined && { jenis: body.jenis }),
        ...(body.materiId !== undefined && { materiId: body.materiId || null }),
        ...(body.pertanyaan !== undefined && { pertanyaan: body.pertanyaan }),
        ...(body.pertanyaanArabic !== undefined && { pertanyaanArabic: body.pertanyaanArabic || null }),
        ...(body.opsiJson !== undefined && { opsiJson: body.opsiJson || null }),
        ...(body.jawabanBenar !== undefined && { jawabanBenar: body.jawabanBenar || null }),
        ...(body.jawabanAlternatif !== undefined && { jawabanAlternatif: body.jawabanAlternatif || null }),
        ...(body.audioUrl !== undefined && { audioUrl: body.audioUrl || null }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
        ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl || null }),
        ...(body.embedUrl !== undefined && { embedUrl: body.embedUrl || null }),
        ...(body.fase !== undefined && { fase: body.fase || null }),
        ...(body.kategori !== undefined && { kategori: body.kategori || null }),
        ...(body.bobot !== undefined && { bobot: body.bobot }),
        ...(body.tipeSkor !== undefined && { tipeSkor: body.tipeSkor }),
        ...(body.hint !== undefined && { hint: body.hint || null }),
        // FIX v3.0.7 #6: support isAudio flag in update
        ...(body.isAudio !== undefined && { isAudio: body.isAudio }),
        // FIX v3.0.7 #7: support pairsJson in update
        ...(body.pairsJson !== undefined && { pairsJson: body.pairsJson || null }),
      },
    })
    return NextResponse.json({ data: soal })
  }

  if (body.action === 'save-peserta') {
    // Save peserta list (JSON array of NIMs)
    const sesi = await db.sesiUjian.update({
      where: { id: body.sesiId },
      data: { pesertaJson: body.pesertaJson }, // null = semua boleh, JSON array = filter
      include: { level: true, _count: { select: { soal: true, hasil: true } } },
    })
    return NextResponse.json({ data: sesi })
  }

  if (body.action === 'generate-from-script') {
    // Parse custom DSL script → buat soal
    // FIX #7: Format baru (rich text friendly, gak pakai P:/AR:/J: prefix)
    // Format:
    // ## N. [jenis]
    // <pertanyaan bebas, boleh multiline, boleh HTML dari RichTextEditor>
    //
    // jawaban: <jawaban benar>
    // alt: alt1, alt2  (dipisah koma)
    // audio: <url>
    // gambar: <url>
    // video: <url>
    // embed: <url>
    // fase: 1
    // kategori: Mufrodat
    // bobot: 1
    //
    // Untuk MCQ, opsi pakai markdown list dengan [+]:
    // - [+] Dosen  (jawaban benar)
    // - Guru SD
    // - Mahasiswa
    //
    // Pisah antar soal dengan --- (atau ##)
    const { sesiId, script } = body
    if (!sesiId || !script) return NextResponse.json({ error: 'sesiId dan script required' }, { status: 400 })

    const sesi = await db.sesiUjian.findUnique({ where: { id: sesiId } })
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    // Get max no
    const existing = await db.soalUjian.findMany({
      where: { sesiId },
      orderBy: { no: 'desc' },
      take: 1,
    })
    let nextNo = existing[0]?.no ?? 0

    // Parse script: split by ## to get soal blocks (also split by --- as separator)
    const blocks = script.split(/^##\s*/m).filter((b: string) => b.trim())
    let created = 0
    const errors: string[] = []

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx]
      try {
        const lines = block.split('\n')
        // First line: "1. [isian]" or "[isian]" — extract jenis
        // FIX v3.0.7 #7: tambah "sambung" sebagai jenis baru (matching pairs)
        const firstLine = (lines[0] || '').trim()
        const jenisMatch = firstLine.match(/\[(isian|mcq|terjemahan|matching|audio|sambung)\]/i)
          || firstLine.match(/(isian|mcq|terjemahan|matching|audio|sambung)/i)
        if (!jenisMatch) {
          errors.push(`Block ${blockIdx + 1}: jenis tidak ditemukan (pakai format "## 1. [isian]")`)
          continue
        }
        const jenis = jenisMatch[1].toLowerCase()

        // Parse remaining lines:
        // - Lines starting with "- [+]" or "- " = MCQ opsi
        // - Lines starting with "(Na)" or "(Nb)" = sambung pair items (FIX v3.0.7 #7)
        // - Lines with "key: value" = metadata (jawaban, alt, audio, isAudio, dll)
        // - Other lines = pertanyaan (boleh multiline + HTML)
        const pertanyaanLines: string[] = []
        // FIX v3.0.7 #5: opsiArr sekarang array of objects dengan text + imageUrl + audioUrl
        const opsiArr: { text: string; imageUrl?: string; audioUrl?: string; isBenar?: boolean }[] = []
        let jawabanBenar = ''
        const data: Record<string, string> = {}
        // FIX v3.0.7 #7: pairsArr untuk soal jenis sambung — format: [{ a: { text, imageUrl? }, b: { text, imageUrl? } }]
        const pairsArr: { a: { text: string; imageUrl?: string; audioUrl?: string }; b: { text: string; imageUrl?: string; audioUrl?: string } }[] = []
        // FIX v3.2.5 #8: extrasArr untuk extra B items (distractors) — B items tanpa pasangan A
        const extrasArr: { text: string; imageUrl?: string; audioUrl?: string }[] = []
        const pairsMap = new Map<number, { a?: any; b?: any }>()

        let currentOpsiIdx = -1  // track opsi yang sedang di-context (untuk media fields)
        // FIX v3.2.8 #3: track current pair context — supaya "gambar:" / "audio:" setelah baris "(Na)" atau "(Nb)"
        //   di-apply ke side yang benar (a atau b). Sebelumnya bug: pakai `pairMatch` dari current line (selalu null).
        let currentPairContext: { pairNum: number; side: 'a' | 'b' } | null = null
        let currentExtraIdx = -1  // track extra B context (untuk media pada extra)

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]
          const trimmed = line.trim()
          if (!trimmed || trimmed === '---') continue

          // FIX v3.0.7 #7: sambung pair item — format "(Na)" atau "(Nb)" di mana N = nomor pair
          const pairMatch = trimmed.match(/^\((\d+)([ab])\)\s*(.*)$/i)
          if (pairMatch && jenis === 'sambung') {
            const pairNum = parseInt(pairMatch[1])
            const side = pairMatch[2].toLowerCase() as 'a' | 'b'
            const text = pairMatch[3].trim()
            if (!pairsMap.has(pairNum)) pairsMap.set(pairNum, {})
            pairsMap.get(pairNum)![side] = { text }
            // FIX v3.2.8 #3: set context — gambar:/audio: berikutnya apply ke side ini
            currentPairContext = { pairNum, side }
            currentExtraIdx = -1
            currentOpsiIdx = -1
            continue
          }
          // FIX v3.2.5 #8: sambung extra B item (distractor) — format "(extra) text"
          // Extra B items tidak punya pasangan A. Muncul di kolom B saat ujian sebagai jawaban palsu.
          const extraMatch = trimmed.match(/^\(extra\)\s*(.*)$/i)
          if (extraMatch && jenis === 'sambung') {
            extrasArr.push({ text: extraMatch[1].trim() })
            currentExtraIdx = extrasArr.length - 1
            currentPairContext = null
            currentOpsiIdx = -1
            continue
          }
          // FIX v3.2.8 #3: pair media fields — "gambar: ..." / "audio: ..." setelah baris pair
          //   Apply ke pair+side yang sedang di-context (currentPairContext)
          if (currentPairContext && trimmed.match(/^(gambar|audio|audiourl|image|imageurl):/i)) {
            const colonIdx = trimmed.indexOf(':')
            const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
            const val = trimmed.substring(colonIdx + 1).trim()
            const pair = pairsMap.get(currentPairContext.pairNum)
            if (pair && pair[currentPairContext.side]) {
              if (key === 'gambar' || key === 'image' || key === 'imageurl') {
                pair[currentPairContext.side]!.imageUrl = val
              } else if (key === 'audio' || key === 'audiourl') {
                pair[currentPairContext.side]!.audioUrl = val
              }
            }
            continue
          }
          // FIX v3.2.8 #3: extra B media fields — "gambar: ..." / "audio: ..." setelah baris extra
          if (currentExtraIdx >= 0 && trimmed.match(/^(gambar|audio|audiourl|image|imageurl):/i)) {
            const colonIdx = trimmed.indexOf(':')
            const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
            const val = trimmed.substring(colonIdx + 1).trim()
            const extra = extrasArr[currentExtraIdx]
            if (extra) {
              if (key === 'gambar' || key === 'image' || key === 'imageurl') {
                extra.imageUrl = val
              } else if (key === 'audio' || key === 'audiourl') {
                extra.audioUrl = val
              }
            }
            continue
          }

          // MCQ opsi: "- [+]" atau "- "
          if (trimmed.match(/^-\s*\[\+\]/) || trimmed.match(/^-\s+/)) {
            const isBenar = !!trimmed.match(/^-\s*\[\+\]/)
            const opsiText = trimmed.replace(/^-\s*(\[\+\]\s*)?/, '').trim()
            if (opsiText) {
              const newIdx = opsiArr.length
              opsiArr.push({ text: opsiText, isBenar })
              currentOpsiIdx = newIdx  // track untuk media fields berikutnya
              if (isBenar) jawabanBenar = opsiText
              currentPairContext = null
              currentExtraIdx = -1
            }
            continue
          }

          // FIX v3.0.7 #5: media fields untuk MCQ opsi — "gambar: ..." / "audio: ..."
          // Setelah baris opsi, apply ke opsi terakhir (currentOpsiIdx)
          if (currentOpsiIdx >= 0 && trimmed.match(/^(gambar|audio|audiourl|image|imageurl):/i)) {
            const colonIdx = trimmed.indexOf(':')
            const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
            const val = trimmed.substring(colonIdx + 1).trim()
            if (key === 'gambar' || key === 'image' || key === 'imageurl') {
              opsiArr[currentOpsiIdx].imageUrl = val
            } else if (key === 'audio' || key === 'audiourl') {
              opsiArr[currentOpsiIdx].audioUrl = val
            }
            continue
          }

          // Metadata: "key: value"
          const colonIdx = trimmed.indexOf(':')
          if (colonIdx > 0 && !trimmed.match(/^<|^\s*-/)) {
            const key = trimmed.substring(0, colonIdx).trim().toLowerCase()
            const val = trimmed.substring(colonIdx + 1).trim()
            // FIX v3.0.7 #6: tambah 'isAudio' sebagai valid metadata key
            // FIX v3.0.7 #7: tambah 'pairs' untuk trigger parsing pasangan (sebenarnya auto-detect dari (Na)(Nb))
            if (['jawaban', 'j', 'alt', 'alternatif', 'audio', 'audiourl', 'gambar', 'image', 'imageurl', 'video', 'videourl', 'embed', 'embedurl', 'fase', 'kategori', 'bobot', 'ar', 'arabic', 'isaudio'].includes(key)) {
              data[key] = val
              currentOpsiIdx = -1  // reset opsi context — this is a top-level metadata, not opsi media
              currentPairContext = null  // FIX v3.2.8 #3: reset pair context too
              currentExtraIdx = -1
              continue
            }
          }

          // Selain itu: pertanyaan (boleh multiline + HTML)
          pertanyaanLines.push(line)
          currentOpsiIdx = -1  // reset opsi context
          currentPairContext = null  // FIX v3.2.8 #3: reset pair context too
          currentExtraIdx = -1
        }

        const pertanyaan = pertanyaanLines.join('\n').trim()
        if (!pertanyaan && jenis !== 'sambung') {
          errors.push(`Block ${blockIdx + 1}: pertanyaan kosong (tulis di bawah header ##)`)
          continue
        }

        // FIX v3.0.7 #7: untuk sambung, build pairsJson dari pairsMap
        let pairsJson: string | null = null
        let sambungJawaban: string | null = null
        if (jenis === 'sambung') {
          // Convert Map → array of { a, b } in numeric order
          const sortedKeys = Array.from(pairsMap.keys()).sort((a, b) => a - b)
          pairsArr.push(...sortedKeys.map(k => {
            const pair = pairsMap.get(k)!
            return {
              a: pair.a || { text: '' },
              b: pair.b || { text: '' },
            }
          }))
          if (pairsArr.length > 0) {
            pairsJson = JSON.stringify({ pairs: pairsArr, extras: extrasArr })
            // jawabanBenar untuk sambung: JSON mapping { indexA: indexB } (urutan B acak saat display)
            // Misal: pair 1 → a="هذا" b="كتاب". Saat display, B diacak → user pilih mapping.
            // jawabanBenar format: "0,1,2,3" (index correct B for A[0], A[1], ...)
            sambungJawaban = JSON.stringify(pairsArr.map((_, idx) => idx))
          }
        }

        nextNo += 1

        // FIX v3.0.7 #5: opsiJson sekarang array of objects { text, imageUrl?, audioUrl? }
        let opsiJson: string | null = null
        if (jenis === 'mcq' && opsiArr.length > 0) {
          opsiJson = JSON.stringify(opsiArr.map(o => ({
            text: o.text,
            imageUrl: o.imageUrl || undefined,
            audioUrl: o.audioUrl || undefined,
          })))
        }

        // Jawaban benar: dari data['jawaban'] atau dari MCQ [+] atau dari sambung
        const jawaban = jawabanBenar || data['jawaban'] || data['j'] || sambungJawaban || null

        // Alt: split by comma
        let jawabanAlternatif: string | null = null
        if (data['alt'] || data['alternatif']) {
          const altStr = data['alt'] || data['alternatif']
          const alts = altStr.split(',').map((s: string) => s.trim()).filter(Boolean)
          jawabanAlternatif = JSON.stringify(alts)
        }

        const bobot = data['bobot'] ? parseFloat(data['bobot']) : 1
        // FIX v3.0.7 #6: parse isAudio flag
        const isAudio = data['isaudio'] === 'true' || data['isaudio'] === '1' || data['isaudio'] === 'yes'

        await db.soalUjian.create({
          data: {
            sesiId,
            no: nextNo,
            jenis,
            pertanyaan: pertanyaan || (jenis === 'sambung' ? 'Pasangkan item di kolom A dengan kolom B' : pertanyaan),
            pertanyaanArabic: data['ar'] || data['arabic'] || null,
            opsiJson,
            jawabanBenar: jawaban,
            jawabanAlternatif,
            audioUrl: data['audio'] || data['audiourl'] || null,
            imageUrl: data['gambar'] || data['image'] || data['imageurl'] || null,
            videoUrl: data['video'] || data['videourl'] || null,
            embedUrl: data['embed'] || data['embedurl'] || null,
            fase: data['fase'] ? parseInt(data['fase']) : null,
            kategori: data['kategori'] || null,
            bobot,
            // FIX v3.0.7 #6: save isAudio flag
            isAudio,
            // FIX v3.0.7 #7: save pairsJson untuk sambung
            pairsJson,
          },
        })
        created++
      } catch (e: any) {
        errors.push(`Block ${blockIdx + 1}: ${e.message}`)
      }
    }

    return NextResponse.json({ success: true, created, errors: errors.slice(0, 10) })
  }

  // Create sesi
  const sesi = await db.sesiUjian.create({
    data: {
      nama: body.nama,
      levelId: body.levelId,
      mode: body.mode || 'online',
      durasiMenit: body.durasiMenit || 30,
      tanggalMulai: body.tanggalMulai ? new Date(body.tanggalMulai) : new Date(),
      aktif: body.aktif ?? true,
      acakUrutan: body.acakUrutan ?? false,
      jumlahSoalPerMahasiswa: body.jumlahSoalPerMahasiswa ?? null,
      jamMulai: body.jamMulai ?? null,
      jamSelesai: body.jamSelesai ?? null,
      pesertaJson: body.pesertaJson ?? null,
      gunakanFase: body.gunakanFase ?? false,
    },
    include: { level: true, _count: { select: { soal: true, hasil: true } } },
  })
  return NextResponse.json({ data: sesi })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const updated = await db.sesiUjian.update({
    where: { id: body.id },
    data: {
      ...(body.nama !== undefined && { nama: body.nama }),
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.durasiMenit !== undefined && { durasiMenit: body.durasiMenit }),
      ...(body.aktif !== undefined && { aktif: body.aktif }),
      ...(body.acakUrutan !== undefined && { acakUrutan: body.acakUrutan }),
      ...(body.jumlahSoalPerMahasiswa !== undefined && { jumlahSoalPerMahasiswa: body.jumlahSoalPerMahasiswa }),
      ...(body.tanggalMulai !== undefined && { tanggalMulai: body.tanggalMulai ? new Date(body.tanggalMulai) : new Date() }),
      ...(body.jamMulai !== undefined && { jamMulai: body.jamMulai || null }),
      ...(body.jamSelesai !== undefined && { jamSelesai: body.jamSelesai || null }),
      ...(body.pesertaJson !== undefined && { pesertaJson: body.pesertaJson || null }),
      ...(body.gunakanFase !== undefined && { gunakanFase: body.gunakanFase }),
      ...(body.tanggalSelesai !== undefined && { tanggalSelesai: body.tanggalSelesai ? new Date(body.tanggalSelesai) : null }),
    },
    include: { level: true, _count: { select: { soal: true, hasil: true } } },
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.sesiUjian.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
