// Seed script untuk Aplikasi Ujian Hafalan Mufrodat & Tarkib
// Konteks: IAI STIBA Makassar, Level 1 (Marhalah 1)

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ============== DATA KAMAR ==============
const KAMAR_DATA = [
  { nama: 'Kamar A1', gender: 'putra', kapasitas: 8 },
  { nama: 'Kamar A2', gender: 'putra', kapasitas: 8 },
  { nama: 'Kamar B1', gender: 'putri', kapasitas: 6 },
  { nama: 'Kamar B2', gender: 'putri', kapasitas: 6 },
  { nama: 'Kamar C1', gender: 'putra', kapasitas: 4 },
]

// ============== DATA MAHASISWA (dummy) ==============
// Format kode: NIM (mis. 2024001) — login pakai NIM
const MAHASISWA_DATA = [
  { nama: 'Ahmad Fauzan', nim: '2024000001', kamar: 'Kamar A1', gender: 'putra', wa: '0812000000', isKetuaKamar: true },
  { nama: 'Bilal Ramadhan', nim: '2024000002', kamar: 'Kamar A1', gender: 'putra', wa: '0812012345', isKetuaKamar: false },
  { nama: 'Citra Yusuf', nim: '2024000003', kamar: 'Kamar A1', gender: 'putra', wa: '0812024690', isKetuaKamar: false },
  { nama: 'Dimas Ar-Rasyid', nim: '2024000004', kamar: 'Kamar A1', gender: 'putra', wa: '0812037035', isKetuaKamar: false },
  { nama: 'Esa Al-Farabi', nim: '2024000005', kamar: 'Kamar A2', gender: 'putra', wa: '0812049380', isKetuaKamar: true },
  { nama: 'Faiz Hidayat', nim: '2024000006', kamar: 'Kamar A2', gender: 'putra', wa: '0812061725', isKetuaKamar: false },
  { nama: 'Ghifari Nur', nim: '2024000007', kamar: 'Kamar A2', gender: 'putra', wa: '0812074070', isKetuaKamar: false },
  { nama: 'Hafidz Akbar', nim: '2024000008', kamar: 'Kamar A2', gender: 'putra', wa: '0812086415', isKetuaKamar: false },
  { nama: 'Ibrahim Sani', nim: '2024000009', kamar: 'Kamar C1', gender: 'putra', wa: '0812098760', isKetuaKamar: true },
  { nama: 'Jundi Pratama', nim: '2024000010', kamar: 'Kamar C1', gender: 'putra', wa: '0812111105', isKetuaKamar: false },
  { nama: 'Khalisa Aulia', nim: '2024000011', kamar: 'Kamar B1', gender: 'putri', wa: '0812123450', isKetuaKamar: true },
  { nama: 'Latifah Hanun', nim: '2024000012', kamar: 'Kamar B1', gender: 'putri', wa: '0812135795', isKetuaKamar: false },
  { nama: 'Maryam Salsabila', nim: '2024000013', kamar: 'Kamar B1', gender: 'putri', wa: '0812148140', isKetuaKamar: false },
  { nama: 'Nabila Zahra', nim: '2024000014', kamar: 'Kamar B1', gender: 'putri', wa: '0812160485', isKetuaKamar: false },
  { nama: 'Aisyah Putri', nim: '2024000015', kamar: 'Kamar B2', gender: 'putri', wa: '0812172830', isKetuaKamar: true },
  { nama: 'Khadijah Rini', nim: '2024000016', kamar: 'Kamar B2', gender: 'putri', wa: '0812185175', isKetuaKamar: false },
  { nama: 'Sumayya Azzahra', nim: '2024000017', kamar: 'Kamar B2', gender: 'putri', wa: '0812197520', isKetuaKamar: false },
  { nama: 'Zainab Lestari', nim: '2024000018', kamar: 'Kamar B2', gender: 'putri', wa: '0812209865', isKetuaKamar: false },
  { nama: 'Rahma Yuliana', nim: '2024000019', kamar: 'Kamar B2', gender: 'putri', wa: '0812222210', isKetuaKamar: false },
  { nama: 'Taqiuddin Rizki', nim: '2024000020', kamar: 'Kamar C1', gender: 'putra', wa: '0812234555', isKetuaKamar: false },
  { nama: 'Umar Faruq', nim: '2024000021', kamar: 'Kamar A1', gender: 'putra', wa: '0812246900', isKetuaKamar: false },
  { nama: 'Vina Khairunnisa', nim: '2024000022', kamar: 'Kamar B1', gender: 'putri', wa: '0812259245', isKetuaKamar: false },
  { nama: 'Wahyu Salim', nim: '2024000023', kamar: 'Kamar A2', gender: 'putra', wa: '0812271590', isKetuaKamar: false },
  { nama: 'Yusuf Mahfudz', nim: '2024000024', kamar: 'Kamar C1', gender: 'putra', wa: '0812283935', isKetuaKamar: false },
  { nama: 'Zahra Aqila', nim: '2024000025', kamar: 'Kamar B1', gender: 'putri', wa: '0812296280', isKetuaKamar: false },
]

// ============== MATERI MUFRODAT LEVEL 1 ==============
// Kategori tema: keluarga, makanan, ibadah, aktivitas harian, alam
// audioUrl memakai Google Translate TTS (gratis, demo) - produksi: ganti ke Forvo/Madinah Arabic
// Sumber audio mufrodat Arabic yang direkomendasikan:
//  - Forvo.com (native speaker pronunciation, free)
//  - Madinah Arabic (madinaharabic.com) - free course with audio
//  - Quran.com / tanzil.net - untuk lafaz Quran
//  - ArabicPod101 - vocabulary with audio
//  - Wiktionary.org - kata Arab dengan audio
const MUFRODAT_DATA = [
  // --- KELUARGA ---
  { arabic: 'أَبٌ', arti: 'ayah', kategori: 'keluarga', contoh: 'هَذَا أَبِي', audioUrl: 'https://translate.google.com/translate_tts?ie=UTF-8&q=%D8%A3%D8%A8&tl=ar&client=tw-ob' },
  { arabic: 'أُمٌّ', arti: 'ibu', kategori: 'keluarga', contoh: 'هَذِهِ أُمِّي', audioUrl: 'https://translate.google.com/translate_tts?ie=UTF-8&q=%D8%A3%D9%85&tl=ar&client=tw-ob' },
  { arabic: 'ابْنٌ', arti: 'anak laki-laki', kategori: 'keluarga', contoh: 'هَذَا ابْنِي' },
  { arabic: 'بِنْتٌ', arti: 'anak perempuan', kategori: 'keluarga', contoh: 'هَذِهِ بِنْتِي' },
  { arabic: 'أَخٌ', arti: 'saudara laki-laki', kategori: 'keluarga', contoh: 'هَذَا أَخِي' },
  { arabic: 'أُخْتٌ', arti: 'saudara perempuan', kategori: 'keluarga', contoh: 'هَذِهِ أُخْتِي' },
  { arabic: 'جَدٌّ', arti: 'kakek', kategori: 'keluarga', contoh: 'جَدِّي كَبِيرٌ' },
  { arabic: 'جَدَّةٌ', arti: 'nenek', kategori: 'keluarga', contoh: 'جَدَّتِي عَجُوزٌ' },
  // --- MAKANAN ---
  { arabic: 'خُبْزٌ', arti: 'roti', kategori: 'makanan', contoh: 'الْخُبْزُ طَيِّبٌ' },
  { arabic: 'مَاءٌ', arti: 'air', kategori: 'makanan', contoh: 'الْمَاءُ بَارِدٌ' },
  { arabic: 'لَبَنٌ', arti: 'susu', kategori: 'makanan', contoh: 'الْلَّبَنُ حُلْوٌ' },
  { arabic: 'تُفَّاحٌ', arti: 'apel', kategori: 'makanan', contoh: 'التُّفَّاحُ أَحْمَرُ' },
  { arabic: 'تَمْرٌ', arti: 'kurma', kategori: 'makanan', contoh: 'التَّمْرُ حَلَاوَةٌ' },
  { arabic: 'لَحْمٌ', arti: 'daging', kategori: 'makanan', contoh: 'اللَّحْمُ مَشْوِيٌّ' },
  { arabic: 'رُزٌّ', arti: 'beras/nasi', kategori: 'makanan', contoh: 'الرُّزُّ أَبْيَضُ' },
  { arabic: 'سُكَّرٌ', arti: 'gula', kategori: 'makanan', contoh: 'السُّكَّرُ حُلْوٌ' },
  // --- IBADAH ---
  { arabic: 'مَسْجِدٌ', arti: 'masjid', kategori: 'ibadah', contoh: 'الْمَسْجِدُ كَبِيرٌ' },
  { arabic: 'صَلَاةٌ', arti: 'shalat', kategori: 'ibadah', contoh: 'الصَّلَاةُ عَامِدَةٌ' },
  { arabic: 'صَوْمٌ', arti: 'puasa', kategori: 'ibadah', contoh: 'الصَّوْمُ شَهْرٌ' },
  { arabic: 'قُرْآنٌ', arti: 'Al-Quran', kategori: 'ibadah', contoh: 'الْقُرْآنُ كَلَامُ اللَّهِ' },
  { arabic: 'دُعَاءٌ', arti: 'doa', kategori: 'ibadah', contoh: 'الدُّعَاءُ عِبَادَةٌ' },
  { arabic: 'وُضُوءٌ', arti: 'wudhu', kategori: 'ibadah', contoh: 'الْوُضُوءُ طَهَارَةٌ' },
  // --- AKTIVITAS HARIAN ---
  { arabic: 'يَقْرَأُ', arti: 'dia membaca', kategori: 'aktivitas', contoh: 'الطَّالِبُ يَقْرَأُ الْقُرْآنَ' },
  { arabic: 'يَكْتُبُ', arti: 'dia menulis', kategori: 'aktivitas', contoh: 'الْمُعَلِّمُ يَكْتُبُ الدَّرْسَ' },
  { arabic: 'يَأْكُلُ', arti: 'dia makan', kategori: 'aktivitas', contoh: 'الْوَلَدُ يَأْكُلُ الْخُبْزَ' },
  { arabic: 'يَشْرَبُ', arti: 'dia minum', kategori: 'aktivitas', contoh: 'أَنَا أَشْرَبُ الْمَاءَ' },
  { arabic: 'يَنَامُ', arti: 'dia tidur', kategori: 'aktivitas', contoh: 'الطِّفْلُ يَنَامُ فِي اللَّيْلِ' },
  { arabic: 'يَذْهَبُ', arti: 'dia pergi', kategori: 'aktivitas', contoh: 'أَحْمَدُ يَذْهَبُ إِلَى الْمَدْرَسَةِ' },
  { arabic: 'يَجْلِسُ', arti: 'dia duduk', kategori: 'aktivitas', contoh: 'الطَّالِبُ يَجْلِسُ فِي الْفَصْلِ' },
  // --- ALAM ---
  { arabic: 'شَمْسٌ', arti: 'matahari', kategori: 'alam', contoh: 'الشَّمْسُ مُشْرِقَةٌ' },
  { arabic: 'قَمَرٌ', arti: 'bulan', kategori: 'alam', contoh: 'الْقَمَرُ مُنِيرٌ' },
  { arabic: 'سَمَاءٌ', arti: 'langit', kategori: 'alam', contoh: 'السَّمَاءُ زَرْقَاءُ' },
  { arabic: 'أَرْضٌ', arti: 'bumi/tanah', kategori: 'alam', contoh: 'الْأَرْضُ خَضْرَاءُ' },
  { arabic: 'جَبَلٌ', arti: 'gunung', kategori: 'alam', contoh: 'الْجَبَلُ عَالٍ' },
  { arabic: 'بَحْرٌ', arti: 'laut', kategori: 'alam', contoh: 'الْبَحْرُ كَبِيرٌ' },
]

// ============== MATERI TARKIB LEVEL 1 ==============
// Tarkib = pola kalimat
const TARKIB_DATA = [
  { arabic: 'هَذَا...', arti: 'Ini (laki-laki)...', kategori: 'isyarat', contoh: 'هَذَا كِتَابٌ' },
  { arabic: 'هَذِهِ...', arti: 'Ini (perempuan)...', kategori: 'isyarat', contoh: 'هَذِهِ مَدْرَسَةٌ' },
  { arabic: 'ذَلِكَ...', arti: 'Itu (jauh, laki-laki)...', kategori: 'isyarat', contoh: 'ذَلِكَ رَجُلٌ' },
  { arabic: 'تِلْكَ...', arti: 'Itu (jauh, perempuan)...', kategori: 'isyarat', contoh: 'تِلْكَ شَجَرَةٌ' },
  { arabic: 'مَا هَذَا؟', arti: 'Apa ini?', kategori: 'pertanyaan', contoh: 'مَا هَذَا؟ هَذَا قَلَمٌ' },
  { arabic: 'مَنْ هَذَا؟', arti: 'Siapa ini?', kategori: 'pertanyaan', contoh: 'مَنْ هَذَا؟ هَذَا أَبِي' },
  { arabic: 'أَيْنَ...؟', arti: 'Di mana...?', kategori: 'pertanyaan', contoh: 'أَيْنَ الْكِتَابُ؟' },
  { arabic: 'هَلْ...؟', arti: 'Apakah...?', kategori: 'pertanyaan', contoh: 'هَلْ أَنْتَ طَالِبٌ؟' },
  { arabic: 'لَا...', arti: 'Tidak...', kategori: 'penolakan', contoh: 'لَا، أَنَا لَسْتُ طَالِبًا' },
  { arabic: 'نَعَمْ...', arti: 'Ya...', kategori: 'persetujuan', contoh: 'نَعَمْ، أَنَا طَالِبٌ' },
  { arabic: 'عِنْدِي...', arti: 'Saya punya...', kategori: 'kepemilikan', contoh: 'عِنْدِي كِتَابٌ' },
  { arabic: 'لِي...', arti: 'Milik saya...', kategori: 'kepemilikan', contoh: 'هَذَا لِي' },
]

async function main() {
  console.log('🌱 Memulai seed data...')

  // Bersihkan data lama
  await db.detailHasil.deleteMany()
  await db.hasilUjian.deleteMany()
  await db.soalUjian.deleteMany()
  await db.sesiUjian.deleteMany()
  await db.materi.deleteMany()
  await db.mahasiswa.deleteMany()
  await db.level.deleteMany()
  await db.kamar.deleteMany()
  await db.user.deleteMany()
  console.log('✓ Data lama dibersihkan')

  // === User Admin ===
  await db.user.create({
    data: {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: 'Admin',
    },
  })
  console.log('✓ User Admin dibuat (username: admin, password: admin123)')

  // === Level (Marhalah 1-3) ===
  const level1 = await db.level.create({
    data: {
      nomor: 1,
      nama: 'Marhalah 1',
      deskripsi: 'Tingkat dasar: mufrodat harian & tarkib isyarat',
    },
  })
  const level2 = await db.level.create({
    data: {
      nomor: 2,
      nama: 'Marhalah 2',
      deskripsi: 'Tingkat menengah: mufrodat tematik & tarkib kompleks',
    },
  })
  const level3 = await db.level.create({
    data: {
      nomor: 3,
      nama: 'Marhalah 3',
      deskripsi: 'Tingkat lanjut: mufrodat abstrak & tarkib susunan',
    },
  })
  console.log('✓ 3 Marhalah dibuat (1, 2, 3)')

  // === Kamar ===
  const kamarMap: Record<string, string> = {}
  for (const k of KAMAR_DATA) {
    const created = await db.kamar.create({ data: k })
    kamarMap[k.nama] = created.id
  }
  console.log(`✓ ${KAMAR_DATA.length} kamar dibuat`)

  // === Mahasiswa ===
  for (const m of MAHASISWA_DATA) {
    await db.mahasiswa.create({
      data: {
        nim: m.nim,
        nama: m.nama,
        wa: m.wa || null,
        isKetuaKamar: m.isKetuaKamar || false,
        kamarId: kamarMap[m.kamar],
      },
    })
  }
  console.log(`✓ ${MAHASISWA_DATA.length} mahasiswa dibuat`)

  // === Materi Mufrodat ===
  for (const mat of MUFRODAT_DATA) {
    await db.materi.create({
      data: { ...mat, levelId: level1.id, jenis: 'mufrodat' },
    })
  }
  console.log(`✓ ${MUFRODAT_DATA.length} materi mufrodat dibuat`)

  // === Materi Tarkib ===
  for (const mat of TARKIB_DATA) {
    await db.materi.create({
      data: { ...mat, levelId: level1.id, jenis: 'tarkib' },
    })
  }
  console.log(`✓ ${TARKIB_DATA.length} materi tarkib dibuat`)

  // === Sesi Ujian 1: Mufrodat Isian (online) ===
  const sesi1 = await db.sesiUjian.create({
    data: {
      nama: 'Ujian Mufrodat Hari 1 - Isian',
      levelId: level1.id,
      mode: 'online',
      durasiMenit: 20,
      tanggalMulai: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 hari lalu
      aktif: false,
    },
  })

  // Buat 10 soal isian dari mufrodat
  const mufrodatAll = await db.materi.findMany({
    where: { jenis: 'mufrodat', levelId: level1.id },
    take: 10,
  })
  for (let i = 0; i < mufrodatAll.length; i++) {
    const m = mufrodatAll[i]
    await db.soalUjian.create({
      data: {
        sesiId: sesi1.id,
        no: i + 1,
        jenis: 'terjemahan',
        materiId: m.id,
        pertanyaan: `Tuliskan dalam bahasa Arab: "${m.arti}"`,
        pertanyaanArabic: m.arti,
        jawabanBenar: m.arabic,
        jawabanAlternatif: JSON.stringify([m.arti, m.arabic.replace(/[\u064B-\u0652]/g, '')]),
        bobot: 1,
        tipeSkor: 'benar_salah',
        hint: m.arti,
      },
    })
  }
  console.log(`✓ Sesi ujian 1 dibuat (10 soal terjemahan ID-AR)`)

  // === Sesi Ujian 2: MCQ Mufrodat (online) ===
  const sesi2 = await db.sesiUjian.create({
    data: {
      nama: 'Ujian Mufrodat Hari 2 - Pilihan Ganda',
      levelId: level1.id,
      mode: 'online',
      durasiMenit: 15,
      tanggalMulai: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      aktif: false,
    },
  })

  const mufrodatMCQ = await db.materi.findMany({
    where: { jenis: 'mufrodat', levelId: level1.id },
    take: 10,
    skip: 10,
  })
  for (let i = 0; i < mufrodatMCQ.length; i++) {
    const m = mufrodatMCQ[i]
    // Ambil 3 distractor dari materi lain
    const distract = await db.materi.findMany({
      where: { jenis: 'mufrodat', id: { not: m.id } },
      take: 3,
      skip: i,
    })
    const opsi = [m.arti, ...distract.map(d => d.arti)]
    // Acak opsi
    opsi.sort(() => Math.random() - 0.5)
    await db.soalUjian.create({
      data: {
        sesiId: sesi2.id,
        no: i + 1,
        jenis: 'mcq',
        materiId: m.id,
        pertanyaan: `Apa arti dari kata berikut?`,
        pertanyaanArabic: m.arabic,
        opsiJson: JSON.stringify(opsi),
        jawabanBenar: m.arti,
        bobot: 1,
        tipeSkor: 'benar_salah',
      },
    })
  }
  console.log(`✓ Sesi ujian 2 dibuat (10 soal MCQ)`)

  // === Sesi Ujian 3: Tarkib Matching + Isian (hybrid) ===
  const sesi3 = await db.sesiUjian.create({
    data: {
      nama: 'Ujian Tarkib Hari 3 - Matching & Hafalan Lisan',
      levelId: level1.id,
      mode: 'hybrid',
      durasiMenit: 25,
      tanggalMulai: new Date(),
      aktif: true,
      acakUrutan: true,
      jumlahSoalPerMahasiswa: null,
    },
  })

  // Soal matching (1 soal dengan beberapa pasangan)
  const tarkibAll = await db.materi.findMany({
    where: { jenis: 'tarkib', levelId: level1.id },
  })
  // Buat 2 soal matching, masing-masing 5 pasangan
  for (let g = 0; g < 2; g++) {
    const pairs = tarkibAll.slice(g * 5, g * 5 + 5).map(u => ({
      arabic: u.arabic,
      arti: u.arti,
    }))
    // Acak urutan kanan
    const shuffled = [...pairs].sort(() => Math.random() - 0.5)
    await db.soalUjian.create({
      data: {
        sesiId: sesi3.id,
        no: g + 1,
        jenis: 'matching',
        pertanyaan: `Cocokkan kalimat Arabic dengan artinya (Pasangan ${g + 1})`,
        opsiJson: JSON.stringify({ pairs, shuffled }),
        jawabanBenar: JSON.stringify(pairs.map((p, i) => ({ left: p.arabic, right: p.arti }))),
        bobot: 5,
        tipeSkor: '0_100',
      },
    })
  }

  // Tambah 3 soal audio (mock - hafalan lisan)
  const audioMufrodat = await db.materi.findMany({
    where: { jenis: 'mufrodat', levelId: level1.id },
    take: 3,
    skip: 5,
  })
  for (let i = 0; i < audioMufrodat.length; i++) {
    const m = audioMufrodat[i]
    await db.soalUjian.create({
      data: {
        sesiId: sesi3.id,
        no: 3 + i,
        jenis: 'audio',
        materiId: m.id,
        pertanyaan: `Bacakan dengan tepat lafaz Arab dan artinya: ${m.arti}`,
        pertanyaanArabic: m.arabic,
        jawabanBenar: m.arabic,
        bobot: 2,
        tipeSkor: 'A_B_C_D',
        hint: `Hint: lihat materi`,
      },
    })
  }
  console.log(`✓ Sesi ujian 3 dibuat (2 matching + 3 audio - hybrid)`)

  // === Sesi Ujian 4: MCQ dengan randomisasi (acak urutan + ambil subset) ===
  const sesi4 = await db.sesiUjian.create({
    data: {
      nama: 'Ujian MCQ Random - 30 dari 50 soal',
      levelId: level1.id,
      mode: 'online',
      durasiMenit: 20,
      tanggalMulai: new Date(),
      aktif: true,
      acakUrutan: true,
      jumlahSoalPerMahasiswa: 8, // demo: ambil 8 dari total
    },
  })

  // Generate 12 MCQ soal dari materi mufrodat (acak)
  const mufrodatForRandom = await db.materi.findMany({
    where: { jenis: 'mufrodat', levelId: level1.id },
  })
  for (let i = 0; i < Math.min(12, mufrodatForRandom.length); i++) {
    const m = mufrodatForRandom[i]
    const distract = await db.materi.findMany({
      where: { jenis: 'mufrodat', id: { not: m.id } },
      take: 3,
      skip: (i + 1) % 5,
    })
    const opsi = [m.arti, ...distract.map(d => d.arti)]
    opsi.sort(() => Math.random() - 0.5)
    await db.soalUjian.create({
      data: {
        sesiId: sesi4.id,
        no: i + 1,
        jenis: 'mcq',
        materiId: m.id,
        pertanyaan: 'Apa arti dari kata berikut?',
        pertanyaanArabic: m.arabic,
        opsiJson: JSON.stringify(opsi),
        jawabanBenar: m.arti,
        bobot: 1,
        tipeSkor: 'benar_salah',
      },
    })
  }
  console.log(`✓ Sesi ujian 4 dibuat (12 MCQ, ambil 8 per mahasiswa, urutan diacak)`)

  // === Generate hasil dummy untuk dashboard ===
  const allMhs = await db.mahasiswa.findMany()
  const allSesi = [sesi1, sesi2, sesi3]

  for (const mhs of allMhs) {
    for (const sesi of allSesi) {
      // Skip sesi3 untuk sebagian mahasiswa (belum dikerjakan)
      if (sesi.id === sesi3.id && Math.random() > 0.4) continue

      const soalList = await db.soalUjian.findMany({
        where: { sesiId: sesi.id },
        orderBy: { no: 'asc' },
      })
      if (soalList.length === 0) continue

      const hasil = await db.hasilUjian.create({
        data: {
          sesiId: sesi.id,
          mahasiswaId: mhs.id,
          mulai: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          selesai: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000),
          status: 'graded',
          jumlahSoal: soalList.length,
        },
      })

      let jumlahBenar = 0
      let skorTotal = 0
      let totalBobot = 0

      for (const soal of soalList) {
        // Simulasi jawaban benar dengan probabilitas
        const pBenar = 0.6 + Math.random() * 0.3 // 60-90% benar
        const benar = Math.random() < pBenar

        let jawaban = ''
        if (soal.jenis === 'mcq') {
          const opsi = soal.opsiJson ? JSON.parse(soal.opsiJson) : []
          jawaban = benar ? soal.jawabanBenar! : opsi.find((o: string) => o !== soal.jawabanBenar) || ''
        } else if (soal.jenis === 'terjemahan') {
          jawaban = benar ? soal.jawabanBenar! : 'jawaban salah'
        } else if (soal.jenis === 'matching') {
          jawaban = benar ? (soal.jawabanBenar || '') : JSON.stringify([{ left: '', right: '' }])
        } else if (soal.jenis === 'audio') {
          jawaban = '(audio recorded)'
        }

        const skor = benar ? soal.bobot : 0
        if (benar) jumlahBenar++
        skorTotal += skor
        totalBobot += soal.bobot

        await db.detailHasil.create({
          data: {
            hasilId: hasil.id,
            soalId: soal.id,
            jawaban,
            skor,
            benar,
            status: 'graded',
            gradedAt: new Date(),
            catatanPenguji: benar ? null : 'Perlu perbaikan hafalan',
          },
        })
      }

      await db.hasilUjian.update({
        where: { id: hasil.id },
        data: {
          jumlahBenar,
          skorTotal: totalBobot > 0 ? (skorTotal / totalBobot) * 100 : 0,
        },
      })
    }
  }
  console.log(`✓ Hasil ujian dummy dibuat untuk dashboard`)

  console.log('\n🎉 Seed selesai!')
  console.log('   Login Admin: admin / admin123 (ubah password setelah login)')
  console.log('   Login mahasiswa: pakai NIM (2024000001 s/d 2024000025)')
  console.log(`   Database: ${process.env.DATABASE_URL}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
