// ============ WHATSAPP SHARE HELPER ============
// Generate wa.me link dengan pre-filled text message (tanpa API key, gratis)
//
// Format: https://wa.me/<phone>?text=<url-encoded-message>
// - <phone>: nomor dengan kode negara, tanpa "+" atau "0" di depan
//   Contoh: 6281234567890 (Indonesia), 60123456789 (Malaysia)
// - Tanpa <phone>: user diminta pilih kontak di WhatsApp

export function buildWhatsAppUrl(phone: string | null, message: string): string {
  const encodedText = encodeURIComponent(message)
  if (phone) {
    // Bersihkan nomor: hapus "+", " ", "-", "0" di depan
    const cleanPhone = phone.replace(/[\s\-()]/g, '').replace(/^0+/, '').replace(/^\+/, '')
    return `https://wa.me/${cleanPhone}?text=${encodedText}`
  }
  // Tanpa nomor = pilih kontak sendiri (lebih fleksibel)
  return `https://wa.me/?text=${encodedText}`
}

// Open link di tab baru
export function openWhatsAppShare(phone: string | null, message: string) {
  const url = buildWhatsAppUrl(phone, message)
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Format pesan share hasil ujian
export function formatHasilUjianMessage(opts: {
  mahasiswaNama: string
  mahasiswaNim: string
  sesiNama: string
  skor: number
  jumlahBenar: number
  jumlahSoal: number
  gradeArabic?: string
  gradeLetter?: string
  appUrl?: string
}): string {
  const { mahasiswaNama, mahasiswaNim, sesiNama, skor, jumlahBenar, jumlahSoal, gradeArabic, gradeLetter, appUrl } = opts
  const lines = [
    '📊 *Hasil Tes*',
    '',
    `Nama: ${mahasiswaNama}`,
    `NIM: ${mahasiswaNim}`,
    `Sesi: ${sesiNama}`,
    `Skor: *${skor.toFixed(1)}%* (${jumlahBenar}/${jumlahSoal} benar)`,
  ]
  if (gradeArabic && gradeLetter) {
    lines.push(`Predikat: *${gradeArabic}* (${gradeLetter})`)
  }
  if (appUrl) {
    lines.push('')
    lines.push(`🔗 Lihat detail: ${appUrl}`)
  }
  lines.push('')
  lines.push('— Tim Pengembangan Bahasa Ma\'had Lughah')
  return lines.join('\n')
}

// Format pesan evaluasi anggota kamar (untuk ketua kamar)
export function formatEvaluasiKamarMessage(opts: {
  ketuaNama: string
  kamarNama: string
  anggota: Array<{ nama: string; nim: string; skor?: number; status?: string }>
  appUrl?: string
}): string {
  const { ketuaNama, kamarNama, anggota, appUrl } = opts
  const lines = [
    'السلام عليكم',
    '',
    '📋 *Evaluasi Anggota Kamar*',
    '',
    `Kamar: ${kamarNama}`,
    `Ketua: ${ketuaNama}`,
    '',
    '— Daftar Anggota —',
  ]
  anggota.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.nama} (${a.nim})`)
    if (a.skor !== undefined) lines.push(`   Skor terakhir: ${a.skor.toFixed(1)}%`)
    if (a.status) lines.push(`   Status: ${a.status}`)
  })
  if (appUrl) {
    lines.push('')
    lines.push(`🔗 Detail: ${appUrl}`)
  }
  lines.push('')
  lines.push('— Ma\'had Lughah IAI STIBA Makassar')
  return lines.join('\n')
}
