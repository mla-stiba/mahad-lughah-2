// Import data ASLI mahasiswa Ma'had Lughah dari Excel + CSV
// Data sudah diparse ke JSON files di folder scripts/ (self-contained, tidak butuh /tmp/)

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const db = new PrismaClient()

async function main() {
  console.log('🚀 Memulai import data ASLI mahasiswa Ma\'had Lughah...')

  // Load parsed data (self-contained JSON, tidak butuh /tmp/)
  const dataDir = path.join(__dirname)
  const mahasiswaData = JSON.parse(fs.readFileSync(path.join(dataDir, 'mahasiswa_data.json'), 'utf8'))
  const kamarsAll = JSON.parse(fs.readFileSync(path.join(dataDir, 'kamar_data.json'), 'utf8'))

  console.log(`  • ${mahasiswaData.length} mahasiswa Ma'had Lughah`)
  console.log(`  • ${kamarsAll.length} kamar asrama (08.01.01 - 08.04.16)`)

  // === BERSIHKAN DATA LAMA ===
  console.log('\n🧹 Membersihkan data lama...')
  await db.detailHasil.deleteMany()
  await db.hasilUjian.deleteMany()
  await db.soalUjian.deleteMany()
  await db.sesiUjian.deleteMany()
  await db.materi.deleteMany()
  await db.mahasiswa.deleteMany()
  await db.level.deleteMany()
  await db.kamar.deleteMany()
  await db.user.deleteMany()
  console.log('  ✓ Data lama dihapus')

  // === BUAT USER ADMIN ===
  await db.user.create({
    data: {
      username: 'admin',
      password: 'pKZ57d1Jg',
      role: 'admin',
      name: 'Admin',
    },
  })
  console.log('  ✓ User Admin dibuat (admin / pKZ57d1Jg)')

  // === BUAT LEVEL (Marhalah 1-3) ===
  const level1 = await db.level.create({
    data: { nomor: 1, nama: 'Marhalah 1', deskripsi: 'Tingkat dasar: mufrodat harian & tarkib isyarat' },
  })
  await db.level.create({
    data: { nomor: 2, nama: 'Marhalah 2', deskripsi: 'Tingkat menengah: mufrodat tematik & tarkib kompleks' },
  })
  await db.level.create({
    data: { nomor: 3, nama: 'Marhalah 3', deskripsi: 'Tingkat lanjut: mufrodat abstrak & tarkib susunan' },
  })
  console.log('  ✓ 3 Marhalah dibuat')

  // === BUAT KAMAR (08.LL.KK) ===
  const kamarMap: Record<string, string> = {}
  for (const k of kamarsAll) {
    const created = await db.kamar.create({
      data: {
        nama: k.kode,
        gender: k.gender,
        kapasitas: 8,
      },
    })
    kamarMap[k.kode] = created.id
  }
  console.log(`  ✓ ${kamarsAll.length} kamar dibuat (08.01.01 - 08.04.16)`)

  // === BUAT MATERI DUMMY ===
  const MUFRODAT_DATA = [
    { arabic: 'أَبٌ', arti: 'ayah', kategori: 'keluarga', contoh: 'هَذَا أَبِي' },
    { arabic: 'أُمٌّ', arti: 'ibu', kategori: 'keluarga', contoh: 'هَذِهِ أُمِّي' },
    { arabic: 'خُبْزٌ', arti: 'roti', kategori: 'makanan', contoh: 'الْخُبْزُ طَيِّبٌ' },
    { arabic: 'مَاءٌ', arti: 'air', kategori: 'makanan', contoh: 'الْمَاءُ بَارِدٌ' },
    { arabic: 'مَسْجِدٌ', arti: 'masjid', kategori: 'ibadah', contoh: 'الْمَسْجِدُ كَبِيرٌ' },
  ]
  for (const mat of MUFRODAT_DATA) {
    await db.materi.create({
      data: { ...mat, levelId: level1.id, jenis: 'mufrodat', tanggalRilis: new Date() },
    })
  }
  console.log(`  ✓ ${MUFRODAT_DATA.length} materi dummy dibuat`)

  // === IMPORT SEMUA MAHASISWA ASLI ===
  console.log(`\n📥 Import ${mahasiswaData.length} mahasiswa asli...`)
  let created = 0, error = 0
  for (const m of mahasiswaData) {
    try {
      const kamarKode = m.kamar || '08.00.00'
      const kamarId = kamarMap[kamarKode] || kamarMap['08.00.00']
      await db.mahasiswa.create({
        data: {
          nim: m.nim,
          nama: m.nama,
          wa: m.wa || null,
          tanggalLahir: m.tanggalLahir || null,
          isKetuaKamar: m.isKetuaKamar || false,
          kamarId,
        },
      })
      created++
    } catch (e: any) {
      error++
      if (error <= 3) console.error(`  Error untuk NIM ${m.nim}: ${e.message}`)
    }
  }
  console.log(`  ✓ ${created} mahasiswa dibuat, ${error} error`)

  // === STATISTIK ===
  const totalMhs = await db.mahasiswa.count()
  const totalTanggalLahir = await db.mahasiswa.count({ where: { tanggalLahir: { not: null } } })
  const totalKamarAktif = await db.kamar.count({ where: { mahasiswa: { some: {} } } })

  console.log('\n🎉 Import selesai!')
  console.log(`   Total mahasiswa: ${totalMhs}`)
  console.log(`   Tanggal lahir terisi: ${totalTanggalLahir}/${totalMhs}`)
  console.log(`   Kamar terpakai: ${totalKamarAktif} dari ${kamarsAll.length}`)
  console.log(`   Login Admin: admin / pKZ57d1Jg`)
  console.log(`   Login mahasiswa: pakai NIM (mis. ${mahasiswaData[0]?.nim})`)
  console.log(`   Password mahasiswa = tanggal lahir DDMMYYYY (mis. ${mahasiswaData[0]?.tanggalLahir ? (() => { const [y,mo,d] = mahasiswaData[0].tanggalLahir.split('-'); return `${d}${mo}${y}` })() : 'tidak ada'})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
