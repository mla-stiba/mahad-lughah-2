import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cacheable, invalidatePattern } from '@/lib/cache'

// ============ UJIAN API (sisi mahasiswa) ============
// GET  /api/ujian?action=available&mahasiswaId=xxx
// GET  /api/ujian?action=detail&sesiId=xxx&mahasiswaId=xxx
// GET  /api/ujian?action=evaluasi&sesiId=xxx&mahasiswaId=xxx  (kunci jawaban setelah deadline)
// POST /api/ujian?action=start   { sesiId, mahasiswaId }
// POST /api/ujian?action=submit   { hasilId, jawaban: [{soalId, jawaban, audioUrl?}] }
// POST /api/ujian?action=retry    { sesiId, mahasiswaId } — coba ulang setelah deadline (tidak ubah nilai asli)
// POST /api/ujian?action=auto-submit { sesiId } — auto-submit semua yang telat (deadline passed)

function normalizeArabic(s: string): string {
  if (!s) return ''
  return s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase()
}

function checkJawaban(soal: any, jawaban: string): boolean {
  if (!jawaban) return false
  const normalized = normalizeArabic(jawaban)
  const benar = soal.jawabanBenar ? normalizeArabic(soal.jawabanBenar) : ''
  if (normalized === benar) return true
  if (soal.jawabanAlternatif) {
    try {
      const alts: string[] = JSON.parse(soal.jawabanAlternatif)
      return alts.some(a => normalizeArabic(a) === normalized)
    } catch {}
  }
  return false
}

// Check if deadline has passed (tanggalMulai + jamSelesai)
function isDeadlinePassed(sesi: any): boolean {
  if (!sesi.jamSelesai) return false // no deadline set
  const now = new Date()
  const deadlineDate = sesi.tanggalMulai ? new Date(sesi.tanggalMulai) : new Date()
  // Parse jamSelesai (HH:MM) and set on deadlineDate
  const [hours, minutes] = sesi.jamSelesai.split(':').map(Number)
  deadlineDate.setHours(hours, minutes, 0, 0)
  return now > deadlineDate
}

// FIX v3.0.6 #3: Helper untuk auto-submit ongoing hasil ketika deadline sudah lewat.
// Dipanggil dari action=available (saat mhs buka laman Tes) supaya ongoing hasil
// yang tertinggal (misal mhs close browser tanpa submit) tidak stuck ongoing forever.
// Skor dihitung dari detail yang ada + unanswered soal = 0 (counted in divisor).
async function autoSubmitOngoingHasil(sesi: any, hasilId: string) {
  // Refetch full data untuk dapat detail + soal (karena hasil mungkin belum include soal)
  const fullHasil = await db.hasilUjian.findUnique({
    where: { id: hasilId },
    include: { detail: true, sesi: { include: { soal: true } } },
  })
  if (!fullHasil || fullHasil.status !== 'ongoing') return

  // FIX v3.2.6: same bug as submit — use only soal that have detail records, not ALL soal
  const soalIdsWithDetail = new Set(fullHasil.detail.map((d: any) => d.soalId))
  const mhsSoal = fullHasil.sesi.soal.filter((s: any) => soalIdsWithDetail.has(s.id))
  const totalBobot = mhsSoal.reduce((sum: number, s: any) => sum + (s.bobot || 1), 0)
  const totalSoal = mhsSoal.length || (fullHasil.sesi.jumlahSoalPerMahasiswa || fullHasil.sesi.soal.length)

  let jumlahBenar = 0
  let skorTotal = 0
  for (const detail of fullHasil.detail) {
    const soal = fullHasil.sesi.soal.find((s: any) => s.id === detail.soalId)
    if (!soal) continue
    if (detail.benar === true) {
      jumlahBenar++
      skorTotal += soal.bobot
    }
  }

  await db.hasilUjian.update({
    where: { id: hasilId },
    data: {
      status: 'submitted',
      selesai: new Date(),
      jumlahBenar,
      jumlahSoal: totalSoal,
      skorTotal: totalBobot > 0 ? (skorTotal / totalBobot) * 100 : 0,
      catatan: 'Auto-submitted: deadline passed',
    },
  })
}

// Check if mahasiswa is allowed to take the exam (pesertaJson filter)
function isMahasiswaAllowed(sesi: any, nim: string): boolean {
  if (!sesi.pesertaJson) return true // null = semua boleh
  try {
    const allowedNims: string[] = JSON.parse(sesi.pesertaJson)
    if (allowedNims.length === 0) return true // empty array = semua boleh
    return allowedNims.includes(nim)
  } catch {
    return true // parse error = allow all
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const mahasiswaId = searchParams.get('mahasiswaId')
  const sesiId = searchParams.get('sesiId')

  if (action === 'available') {
    const mhs = await db.mahasiswa.findUnique({ where: { id: mahasiswaId! } })
    if (!mhs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const sesiList = await db.sesiUjian.findMany({
      where: { aktif: true },
      include: {
        level: true,
        _count: { select: { soal: true } },
        hasil: { where: { mahasiswaId: mhs.id }, include: { detail: true } },
      },
      orderBy: { tanggalMulai: 'desc' },
    })

    // Filter by pesertaJson
    const allowedSesi = sesiList.filter(s => isMahasiswaAllowed(s, mhs.nim))

    // FIX v3.0.6 #3: auto-submit ongoing hasil yang deadline-nya sudah lewat.
    // Trigger saat mhs buka laman Tes — supaya gak stuck ongoing forever.
    // Misal mhs mulai tes jam 20:00, deadline 22:30, lalu gak submit → besok pagi buka laman Tes
    // → auto-submit ongoing → skor dihitung dari jawaban yang ada (unanswered = 0).
    for (const s of allowedSesi) {
      if (isDeadlinePassed(s)) {
        const ongoingHasil = s.hasil?.find((h: any) => h.status === 'ongoing')
        if (ongoingHasil) {
          // Direct call helper (no fetch — avoid self-request overhead)
          await autoSubmitOngoingHasil(s, ongoingHasil.id)
        }
      }
    }

    // Re-fetch setelah auto-submit supaya status terupdate
    const refreshedSesiList = await db.sesiUjian.findMany({
      where: { aktif: true },
      include: {
        level: true,
        _count: { select: { soal: true } },
        hasil: { where: { mahasiswaId: mhs.id } },
      },
      orderBy: { tanggalMulai: 'desc' },
    })
    const refreshedAllowed = refreshedSesiList.filter(s => isMahasiswaAllowed(s, mhs.nim))

    // Check deadline status for each sesi
    const sesiWithStatus = refreshedAllowed.map(s => ({
      ...s,
      deadlinePassed: isDeadlinePassed(s),
    }))

    return NextResponse.json({ data: sesiWithStatus })
  }

  if (action === 'detail') {
    const sesi = await db.sesiUjian.findUnique({
      where: { id: sesiId! },
      include: {
        level: true,
        soal: { orderBy: { no: 'asc' }, include: { materi: true } },
      },
    })
    if (!sesi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const mhs = await db.mahasiswa.findUnique({ where: { id: mahasiswaId! } })
    if (!mhs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check peserta access
    if (!isMahasiswaAllowed(sesi, mhs.nim)) {
      return NextResponse.json({ error: 'Anda tidak terdaftar sebagai peserta ujian ini' }, { status: 403 })
    }

    const hasil = await db.hasilUjian.findFirst({
      where: { sesiId: sesiId!, mahasiswaId: mahasiswaId! },
      include: { detail: true },
    })

    // ===== RANDOMISASI PER MAHASISWA =====
    let soalUntukMahasiswa = sesi.soal
    if (sesi.acakUrutan || sesi.jumlahSoalPerMahasiswa) {
      const seedStr = `${mahasiswaId}-${sesiId}`
      let seed = 0
      for (let i = 0; i < seedStr.length; i++) {
        seed = ((seed << 5) - seed) + seedStr.charCodeAt(i)
        seed |= 0
      }
      const prng = () => {
        let t = (seed += 0x6D2B79F5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }

      if (sesi.gunakanFase) {
        // ===== SHUFFLE PER FASE =====
        // Group soal by fase, shuffle within each fase, then concatenate fase 1 → 2 → 3...
        const faseGroups: Record<number, any[]> = {}
        const noFase: any[] = []
        for (const s of sesi.soal) {
          const f = s.fase || 0
          if (f > 0) {
            if (!faseGroups[f]) faseGroups[f] = []
            faseGroups[f].push(s)
          } else {
            noFase.push(s) // soal tanpa fase = ditaruh di akhir
          }
        }
        const sortedFases = Object.keys(faseGroups).map(Number).sort((a, b) => a - b)
        let shuffled: any[] = []
        for (const fase of sortedFases) {
          const group = [...faseGroups[fase]]
          for (let i = group.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1))
            ;[group[i], group[j]] = [group[j], group[i]]
          }
          // Ambil subset per fase jika jumlahSoalPerMahasiswa di-set
          if (sesi.jumlahSoalPerMahasiswa) {
            const perFase = Math.ceil(sesi.jumlahSoalPerMahasiswa / sortedFases.length)
            shuffled.push(...group.slice(0, perFase))
          } else {
            shuffled.push(...group)
          }
        }
        // Tambah soal tanpa fase di akhir
        for (let i = noFase.length - 1; i > 0; i--) {
          const j = Math.floor(prng() * (i + 1))
          ;[noFase[i], noFase[j]] = [noFase[j], noFase[i]]
        }
        shuffled.push(...noFase)
        // Limit total jika perlu
        if (sesi.jumlahSoalPerMahasiswa && shuffled.length > sesi.jumlahSoalPerMahasiswa) {
          shuffled = shuffled.slice(0, sesi.jumlahSoalPerMahasiswa)
        }
        soalUntukMahasiswa = shuffled
      } else {
        // ===== SHUFFLE GLOBAL (sebelumnya) =====
        const shuffled = [...sesi.soal]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(prng() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        if (sesi.jumlahSoalPerMahasiswa && sesi.jumlahSoalPerMahasiswa < shuffled.length) {
          soalUntukMahasiswa = shuffled.slice(0, sesi.jumlahSoalPerMahasiswa)
        } else {
          soalUntukMahasiswa = shuffled
        }
      }
    }

    // ===== ANTI-CHEAT: STRIP JAWABAN BENAR =====
    const soalSanitized = soalUntukMahasiswa.map(s => {
      const pertanyaanArabicSafe =
        s.pertanyaanArabic && s.jawabanBenar &&
        s.pertanyaanArabic.trim() === s.jawabanBenar.trim()
          ? null
          : s.pertanyaanArabic
      return {
        ...s,
        pertanyaanArabic: pertanyaanArabicSafe,
        jawabanBenar: undefined,
        jawabanAlternatif: undefined,
      }
    })

    // Check deadline status
    const deadlinePassed = isDeadlinePassed(sesi)

    const sesiWithShuffled = { ...sesi, soal: soalSanitized, deadlinePassed }

    return NextResponse.json({ data: { sesi: sesiWithShuffled, hasil } })
  }

  if (action === 'evaluasi') {
    // Evaluasi: kunci jawaban + jawaban mahasiswa, hanya jika deadline passed
    const sesi = await db.sesiUjian.findUnique({
      where: { id: sesiId! },
      include: { soal: { orderBy: { no: 'asc' } } },
    })
    if (!sesi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Check deadline
    if (!isDeadlinePassed(sesi)) {
      return NextResponse.json({ error: 'Evaluasi baru tersedia setelah batas waktu ujian berakhir' }, { status: 403 })
    }

    // Check mahasiswa has submitted
    const hasil = await db.hasilUjian.findFirst({
      where: { sesiId: sesiId!, mahasiswaId: mahasiswaId! },
      include: { detail: true },
    })
    if (!hasil || (hasil.status !== 'submitted' && hasil.status !== 'graded')) {
      return NextResponse.json({ error: 'Anda harus mengumpulkan ujian terlebih dahulu' }, { status: 403 })
    }

    // Apply same randomization for this mahasiswa (same seed)
    let soalUntukMahasiswa = sesi.soal
    if (sesi.acakUrutan || sesi.jumlahSoalPerMahasiswa) {
      const seedStr = `${mahasiswaId}-${sesiId}`
      let seed = 0
      for (let i = 0; i < seedStr.length; i++) {
        seed = ((seed << 5) - seed) + seedStr.charCodeAt(i)
        seed |= 0
      }
      const prng = () => {
        let t = (seed += 0x6D2B79F5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const shuffled = [...sesi.soal]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      if (sesi.jumlahSoalPerMahasiswa && sesi.jumlahSoalPerMahasiswa < shuffled.length) {
        soalUntukMahasiswa = shuffled.slice(0, sesi.jumlahSoalPerMahasiswa)
      } else {
        soalUntukMahasiswa = shuffled
      }
    }

    // Return soal WITH jawabanBenar (for evaluasi) + hasil detail
    return NextResponse.json({
      data: {
        sesi: { ...sesi, soal: soalUntukMahasiswa },
        hasil,
      },
    })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const body = await req.json()

  if (action === 'start') {
    // FIX #6: Block start kalau deadline sudah lewat — ujian terkunci otomatis
    const sesiForCheck = await db.sesiUjian.findUnique({
      where: { id: body.sesiId },
    })
    if (!sesiForCheck) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    if (isDeadlinePassed(sesiForCheck)) {
      return NextResponse.json({
        error: 'Batas waktu ujian sudah berakhir. Ujian terkunci, tidak bisa dikerjakan.',
      }, { status: 423 }) // 423 Locked
    }

    let hasil = await db.hasilUjian.findFirst({
      where: { sesiId: body.sesiId, mahasiswaId: body.mahasiswaId },
    })
    if (!hasil) {
      const sesi = await db.sesiUjian.findUnique({
        where: { id: body.sesiId },
        include: { soal: true },
      })

      // Calculate actual soal count for this mahasiswa (after randomization/subset)
      let actualSoalCount = sesi?.soal.length || 0
      if (sesi?.jumlahSoalPerMahasiswa && sesi.jumlahSoalPerMahasiswa < actualSoalCount) {
        actualSoalCount = sesi.jumlahSoalPerMahasiswa
      }

      hasil = await db.hasilUjian.create({
        data: {
          sesiId: body.sesiId,
          mahasiswaId: body.mahasiswaId,
          status: 'ongoing',
          jumlahSoal: actualSoalCount, // subset count, bukan total
        },
      })
    }
    invalidatePattern('hasil:*')
    return NextResponse.json({ data: hasil })
  }

  if (action === 'submit') {
    const hasil = await db.hasilUjian.findUnique({
      where: { id: body.hasilId },
      include: { sesi: { include: { soal: true } } },
    })
    if (!hasil) return NextResponse.json({ error: 'Hasil tidak ditemukan' }, { status: 404 })

    // FIX #6: Block submit kalau deadline sudah lewat — ujian terkunci otomatis
    if (isDeadlinePassed(hasil.sesi)) {
      // Kalau masih ongoing, auto-mark sebagai submitted dengan skor 0 (late submit)
      if (hasil.status === 'ongoing') {
        const lateUpdated = await db.hasilUjian.update({
          where: { id: hasil.id },
          data: {
            status: 'submitted',
            selesai: new Date(),
            jumlahBenar: 0,
            skorTotal: 0,
            catatan: 'Auto-submitted: deadline passed (skor 0)',
          },
        })
        return NextResponse.json({
          data: lateUpdated,
          error: 'Batas waktu sudah berakhir. Jawaban Anda tidak diterima, nilai 0.',
        }, { status: 423 })
      }
      return NextResponse.json({
        error: 'Batas waktu ujian sudah berakhir. Tidak bisa submit ulang.',
      }, { status: 423 })
    }

    let jumlahBenar = 0
    let skorTotal = 0
    // FIX v3.2.6: BUG SEBENARNYA — totalBobot & totalSoal pakai ALL sesi.soal (100),
    // bukan subset yang diberikan ke mhs (30). Saat jumlahSoalPerMahasiswa=30, mhs kerjakan
    // 30 soal tapi skor dibagi 100 → skor salah (29/100 bukan 29/30).
    // FIX: filter sesi.soal ke hanya soal yang ada di body.jawaban (30 soal yang diberikan).
    const soalIdsInJawaban = new Set(body.jawaban.map((j: any) => j.soalId))
    const mhsSoal = hasil.sesi.soal.filter((s: any) => soalIdsInJawaban.has(s.id))
    const totalBobot = mhsSoal.reduce((sum: number, s: any) => sum + (s.bobot || 1), 0)
    const totalSoal = mhsSoal.length

    await db.detailHasil.deleteMany({ where: { hasilId: hasil.id } })

    // Track soal yang dijawab untuk handle yang gak dijawab (auto-salah)
    const jawabanBySoalId = new Map(body.jawaban.map((j: any) => [j.soalId, j.jawaban]))

    // FIX v3.2.2: ganti N×db.detailHasil.create → 1×db.detailHasil.createMany (bulk insert).
    // Sebelumnya: loop setiap soal dan create per soal = N round-trip ke DB. Untuk 30 soal = 30
    // DB writes → "submit lama" → mhs terkeluar → jawaban kosong. Sekarang: 1 bulk insert.
    const detailData: any[] = []
    // FIX v3.2.6: loop mhsSoal (30 subset), bukan hasil.sesi.soal (100 total)
    for (const soal of mhsSoal) {
      const jawabanText = jawabanBySoalId.get(soal.id)
      const isAnswered = jawabanText !== undefined && jawabanText !== null && jawabanText !== ''

      let benar = false
      let skor = 0

      // FIX v3.2.5 #9: sambung scoring — partial credit per pair (riset: standard matching question scoring)
      // Each correct pair = 1 share of bobot. Wrong/unmatched = 0 for that pair.
      // Score = (correctPairs / totalPairs) * bobot. No negative marking.
      // benar = all pairs correct (for jumlahBenar count).
      if (isAnswered && soal.jenis === 'sambung' && soal.pairsJson) {
        try {
          const pairsData = JSON.parse(soal.pairsJson)
          const totalPairs = (pairsData.pairs || []).length
          const userAnswer = JSON.parse(jawabanText) // { aIdx: bOriginalIdx }
          let correctPairs = 0
          for (let i = 0; i < totalPairs; i++) {
            // Correct answer: aIdx i → bOriginalIdx i (since pairs are 0-indexed, correct match is i→i)
            if (Number(userAnswer[String(i)]) === i) correctPairs++
          }
          // Partial credit: skor = (correct / total) * bobot
          skor = totalPairs > 0 ? (correctPairs / totalPairs) * soal.bobot : 0
          // benar only if all pairs correct (for jumlahBenar)
          benar = correctPairs === totalPairs
        } catch {
          benar = false
          skor = 0
        }
      } else if (isAnswered && (soal.jenis === 'mcq' || soal.jenis === 'isian' || soal.jenis === 'terjemahan' || soal.jenis === 'audio')) {
        benar = checkJawaban(soal, jawabanText)
      }
      // Unanswered soal: benar = false, skor = 0 (auto)

      if (benar) {
        jumlahBenar++
        skor = soal.bobot
      }
      // FIX v3.2.5 #9: untuk sambung, skor sudah di-compute di atas (partial credit)
      // Untuk jenis lain, skor = soal.bobot kalau benar (sudah di-set di if benar block)
      if (soal.jenis === 'sambung' && isAnswered) {
        // skor already set from partial credit computation above — don't overwrite
      } else if (benar) {
        skor = soal.bobot
      }
      skorTotal += skor

      detailData.push({
        hasilId: hasil.id,
        soalId: soal.id,
        jawaban: jawabanText || null,
        skor,
        benar,
        status: 'graded',
        gradedAt: new Date(),
      })
    }

    // BULK INSERT — 1 DB round-trip untuk semua detail (cepat, no timeout)
    await db.detailHasil.createMany({ data: detailData })

    const updated = await db.hasilUjian.update({
      where: { id: hasil.id },
      data: {
        status: 'submitted',
        selesai: new Date(),
        jumlahBenar,
        // FIX v3.0.6 #3: jumlahSoal = total soal di sesi (bukan jumlah yang dijawab)
        jumlahSoal: totalSoal,
        // FIX v3.0.6 #3: divisor = sum ALL soal.bobot (unanswered = 0 skor, reduces %)
        skorTotal: totalBobot > 0 ? (skorTotal / totalBobot) * 100 : 0,
      },
    })

    invalidatePattern('hasil:*')
    return NextResponse.json({ data: updated })
  }

  if (action === 'retry') {
    // Retry: create a NEW hasil record (doesn't affect original score)
    // Only allowed after deadline passed
    const sesi = await db.sesiUjian.findUnique({ where: { id: body.sesiId } })
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    if (!isDeadlinePassed(sesi)) {
      return NextResponse.json({ error: 'Coba ulang hanya tersedia setelah batas waktu ujian berakhir' }, { status: 403 })
    }

    // Check mahasiswa has submitted the original
    const originalHasil = await db.hasilUjian.findFirst({
      where: { sesiId: body.sesiId, mahasiswaId: body.mahasiswaId },
    })
    if (!originalHasil || (originalHasil.status !== 'submitted' && originalHasil.status !== 'graded')) {
      return NextResponse.json({ error: 'Anda harus mengumpulkan ujian terlebih dahulu sebelum coba ulang' }, { status: 403 })
    }

    // Create a NEW hasil record for retry (marked with status 'retry')
    const retryHasil = await db.hasilUjian.create({
      data: {
        sesiId: body.sesiId,
        mahasiswaId: body.mahasiswaId,
        status: 'ongoing',
        jumlahSoal: originalHasil.jumlahSoal,
        catatan: 'RETRY - tidak mempengaruhi nilai asli',
      },
    })

    invalidatePattern('hasil:*')
    return NextResponse.json({ data: retryHasil })
  }

  if (action === 'auto-submit') {
    // Auto-submit all ongoing hasil where deadline has passed
    const sesi = await db.sesiUjian.findUnique({
      where: { id: body.sesiId },
      include: { soal: true, hasil: { where: { status: 'ongoing' }, include: { detail: true } } },
    })
    if (!sesi) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })

    if (!isDeadlinePassed(sesi)) {
      return NextResponse.json({ error: 'Batas waktu belum berakhir' }, { status: 400 })
    }

    // FIX v3.2.6: jangan pakai ALL sesi.soal (100). Per-hasil, gunakan only soal yang ada di detail.
    let autoSubmitted = 0
    for (const hasil of sesi.hasil) {
      // Hitung jumlah benar dari detail yang ada
      let jumlahBenar = 0
      let skorTotal = 0

      // FIX v3.2.6: filter soal ke only yang ada di detail record (subset yang diberikan ke mhs)
      const soalIdsInDetail = new Set(hasil.detail.map((d: any) => d.soalId))
      const mhsSoal = sesi.soal.filter((s: any) => soalIdsInDetail.has(s.id))
      const mhsTotalBobot = mhsSoal.reduce((sum: number, s: any) => sum + (s.bobot || 1), 0)
      const mhsTotalSoal = mhsSoal.length || (sesi.jumlahSoalPerMahasiswa || sesi.soal.length)

      for (const detail of hasil.detail) {
        const soal = sesi.soal.find(s => s.id === detail.soalId)
        if (!soal) continue
        if (detail.benar === true) {
          jumlahBenar++
          skorTotal += soal.bobot
        }
      }
      // Unanswered soal (gak ada detail) = 0 skor (auto). Divisor = mhsTotalBobot (subset soal).

      await db.hasilUjian.update({
        where: { id: hasil.id },
        data: {
          status: 'submitted',
          selesai: new Date(),
          jumlahBenar,
          jumlahSoal: mhsTotalSoal,
          // FIX v3.2.6: divisor = mhsTotalBobot (subset), bukan totalBobot (all 100)
          skorTotal: mhsTotalBobot > 0 ? (skorTotal / mhsTotalBobot) * 100 : 0,
          catatan: 'Auto-submitted: deadline passed',
        },
      })
      autoSubmitted++
    }

    return NextResponse.json({ success: true, autoSubmitted })
  }

  return NextResponse.json({ error: 'Action tidak dikenal' }, { status: 400 })
}
