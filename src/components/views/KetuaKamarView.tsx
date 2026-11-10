'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { openWhatsAppShare, formatEvaluasiKamarMessage } from '@/lib/wa-share'
import { ArabicText, EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, AlertTriangle, Users, BookOpen, Share2, Loader2, Copy, Plus, Calendar } from 'lucide-react'

interface KetuaKamarViewProps {
  session: any
}

// ============ KETUA KAMAR VIEW ============
// Tampil untuk mahasiswa dengan isKetuaKamar = true.
// Berisi 3 tab:
// 1. Anggota Kamar: list anggota + status login hari ini + tombol ingatkan WA
// 2. Monitoring Hafalan: grid anggota x materi dengan checkbox
// 3. Belum Lihat Materi: list materi baru + anggota yang belum view

export function KetuaKamarView({ session }: KetuaKamarViewProps) {
  const [activeTab, setActiveTab] = useState('anggota')

  // ===== DATA ANGGOTA KAMAR =====
  const [kamarData, setKamarData] = useState<any>(null)
  // FIX: tambah state untuk hasil ujian per anggota (fetch from /api/hasil?action=by-kamar)
  const [hasilByKamar, setHasilByKamar] = useState<any[]>([])
  const [loadingKamar, setLoadingKamar] = useState(true)
  const [notifSent, setNotifSent] = useState<Set<string>>(new Set()) // nim yang sudah diingatkan
  // FIX v2.9.4: tambah state selectedDate (default hari ini) — untuk filter hasil tes per tanggal.
  // Sebelumnya latestHasil = anggotaHasil[0] = hasil tes TERBARU GLOBAL (bukan per tanggal).
  // User mau: tampilkan hasil tes yang dikerjakan HARI ITU, bukan hasil tes terakhir secara global.
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  // FIX v3.0.0: state total sesi count untuk komputasi rata-rata skor per anggota.
  // Logic baru: rata-rata = sum(skorTotal per sesi) / totalSesi.
  // Kalau anggota GAK ikut sesi X, skor untuk sesi X = 0 (BUKAN skip).
  // Misal: 2 sesi total, anggota kerja 1 (dapat 100%), gak ikut sesi 1 → rata-rata = (0+100)/2 = 50%.
  const [totalSesiCount, setTotalSesiCount] = useState(0)

  // FIX v2.9.6: helper untuk ambil YYYY-MM-DD pakai LOCAL TIMEZONE browser user.
  // Sebelumnya pakai d.toISOString().slice(0, 10) yang return UTC date — kalau hasil tes
  // dikerjakan jam 06:30 WIB tanggal 16 (= 23:30 UTC tanggal 15), filter missed untuk selectedDate=16.
  // Pakai getFullYear/getMonth/getDate (local timezone components) supaya konsisten dengan date picker.
  function getLocalDateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  async function loadKamarStatus() {
    if (!session.mahasiswa?.kamar?.id) return
    setLoadingKamar(true)
    try {
      // FIX v3.0.0: tambah fetch /api/sesi untuk hitung total sesi count (yang sudah lewat tanggalMulai).
      // Dipakai sebagai divisor untuk rata-rata skor per anggota.
      const [kamarR, hasilR, sesiR] = await Promise.all([
        fetch(`/api/tracking?action=kamar-status&kamarId=${session.mahasiswa.kamar.id}`).then(r => r.json()),
        fetch(`/api/hasil?action=by-kamar&kamarId=${session.mahasiswa.kamar.id}`).then(r => r.json()),
        fetch('/api/sesi').then(r => r.json()),
      ])
      setKamarData(kamarR.data)
      // FIX v3.0.1 (BUG SEBENARNYA): API by-kamar return data terstruktur sebagai
      // [{ id: kamarId, nama, avg, count, hasil: [...] }] (array of kamar GROUPS).
      // Sebelumnya setHasilByKamar(hasilR.data) — pakai array grup kamar langsung sebagai
      // array flat hasil tes → filter h.mahasiswaId === a.id gak nemu apa2 (h = grup, bukan hasil)
      // → sum = 0 → rata-rata = 0% untuk semua anggota.
      // FIX: cari grup kamar yang sesuai, extract array hasil tes dari dalam grup itu.
      const kamarId = session.mahasiswa.kamar.id
      const kamarGroup = (hasilR.data || []).find((k: any) => k.id === kamarId)
      const flatHasil = kamarGroup?.hasil || []
      // sort hasil by selesai desc (terbaru di atas) — untuk fallback latest tes
      const sortedHasil = flatHasil.sort((a: any, b: any) => {
        const da = a.selesai ? new Date(a.selesai).getTime() : 0
        const db = b.selesai ? new Date(b.selesai).getTime() : 0
        return db - da
      })
      setHasilByKamar(sortedHasil)
      // FIX v3.0.1 (BUG SEBENARNYA): filter sesi sebelumnya pakai `new Date(tanggalMulai) <= todayStart`
      // (timestamp comparison). todayStart = midnight hari ini. Sesi yang tanggalMulai-nya jam 15:00
      // hari ini → new Date > todayStart → SALAH filtered out, padahal sesi tsb SUDAH lewat tanggalMulai.
      // FIX: bandingkan YYYY-MM-DD string (pakai getLocalDateKey). Sesi dihitung kalau tanggalMulai
      // jatuh pada hari ini atau sebelumnya (<= today).
      const now = new Date()
      const todayStr = getLocalDateKey(now) // YYYY-MM-DD local timezone
      const allSesi = sesiR?.data || []
      const pastSesi = allSesi.filter((s: any) => {
        if (!s.tanggalMulai) return false
        const sesiDateStr = getLocalDateKey(new Date(s.tanggalMulai))
        return sesiDateStr <= todayStr // string comparison YYYY-MM-DD = chronological
      })
      setTotalSesiCount(pastSesi.length)
    } catch (e: any) {
      toast({ title: 'Gagal load data kamar', description: e.message, variant: 'destructive' })
    }
    setLoadingKamar(false)
  }

  // FIX v3.0.0: compute rata-rata skor per anggota.
  // Logic: sum(skorTotal per sesi yang diikuti) / totalSesiCount (yang sudah lewat).
  // Sesi yang tidak diikuti dihitung sebagai 0.
  // Misal: 3 sesi total, anggota ikut 2 (skor 80% + 100%), gak ikut 1 → rata-rata = (80+100+0)/3 = 60%.
  function computeRataRataAnggota(mahasiswaId: string): { rata: number; jumlahSesiDiikuti: number; totalSesi: number } {
    if (totalSesiCount === 0) {
      return { rata: 0, jumlahSesiDiikuti: 0, totalSesi: 0 }
    }
    const anggotaHasil = hasilByKamar.filter(h => h.mahasiswaId === mahasiswaId && h.skorTotal != null) || []
    const sumSkor = anggotaHasil.reduce((sum, h) => sum + (h.skorTotal || 0), 0)
    const rata = sumSkor / totalSesiCount
    return {
      rata: Number(rata.toFixed(1)),
      jumlahSesiDiikuti: anggotaHasil.length,
      totalSesi: totalSesiCount,
    }
  }

  useEffect(() => { loadKamarStatus() }, [])

  // ===== DATA HAFALAN =====
  const [hafalanGrid, setHafalanGrid] = useState<any[]>([])
  const [materiList, setMateriList] = useState<any[]>([])
  const [loadingHafalan, setLoadingHafalan] = useState(true)
  const [filterLevel, setFilterLevel] = useState('all')
  // FIX #2 user: tambah state untuk filter paket (pilih paket materi di tab Hafalan)
  const [paketList, setPaketList] = useState<any[]>([])
  // FIX v2.9.3: filterPaket default 'all' — diubah jadi '' (force user pilih paket).
  // Opsi "Semua Paket Materi" dihapus dari dropdown sesuai request user.
  const [filterPaket, setFilterPaket] = useState('')
  // FIX v2.9.5: state hafalanAllMateri terpisah untuk tab Kamar & Salin Evaluasi.
  // hafalanGrid = grid interactive di tab Hafalan (PER PAKET, filter by filterPaket).
  // hafalanAllMateri = summary SEMUA materi (tidak terikat paket) — untuk tampil di tab Kamar
  // per-anggota + shareEvaluasiSemua. Sebelumnya pakai hafalanGrid yang bisa kosong kalau belum
  // pilih paket, atau hanya cover 1 paket — jadi laporan WA salah (0/0 atau partial).
  const [hafalanAllMateri, setHafalanAllMateri] = useState<any[]>([])
  const [allMateriList, setAllMateriList] = useState<any[]>([])

  async function loadHafalanGrid() {
    if (!session.mahasiswa?.kamar?.id) return
    // FIX v2.9.3: skip fetch kalau paket belum dipilih (opsi "Semua Paket Materi" dihapus).
    // Tampilkan empty state dengan pesan "Pilih paket materi dulu" di UI.
    if (!filterPaket) {
      setHafalanGrid([])
      setMateriList([])
      setLoadingHafalan(false)
      return
    }
    setLoadingHafalan(true)
    try {
      const r = await fetch(`/api/hafalan?kamarId=${session.mahasiswa.kamar.id}&levelId=${filterLevel}&paketId=${filterPaket}`).then(r => r.json())
      setHafalanGrid(r.data || [])
      setMateriList(r.materiList || [])
    } catch (e: any) {
      toast({ title: 'Gagal load data hafalan', description: e.message, variant: 'destructive' })
    }
    setLoadingHafalan(false)
  }

  // Load paket list untuk dropdown filter
  useEffect(() => {
    fetch('/api/paket-materi').then(r => r.json()).then(r => setPaketList(r.data || [])).catch(() => {})
  }, [])

  // FIX v2.9.5: load hafalan SEMUA materi (tanpa paketId) untuk tab Kamar & Salin Evaluasi.
  // Pakai endpoint /api/hafalan?kamarId=X TANPA paketId → return SEMUA materi yang sudah rilis
  // (lepas + di paket). Ini independent dari filterPaket di tab Hafalan.
  async function loadAllMateriHafalan() {
    if (!session.mahasiswa?.kamar?.id) return
    try {
      const r = await fetch(`/api/hafalan?kamarId=${session.mahasiswa.kamar.id}`).then(r => r.json())
      setHafalanAllMateri(r.data || [])
      setAllMateriList(r.materiList || [])
    } catch {
      // Silent fail — gak kritis, tab Kamar masih jalan pakai data lain
    }
  }

  useEffect(() => { loadAllMateriHafalan() }, [])

  useEffect(() => { loadHafalanGrid() }, [filterLevel, filterPaket])

  async function updateHafalan(mahasiswaId: string, materiId: string, status: string) {
    // Optimistic update
    setHafalanGrid(prev => prev.map(row => {
      if (row.mahasiswa.id !== mahasiswaId) return row
      return {
        ...row,
        materi: row.materi.map((m: any) => m.materi.id === materiId ? { ...m, status } : m),
      }
    }))
    try {
      await fetch('/api/hafalan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mahasiswaId, materiId, status,
          centangBy: session.mahasiswa.nama,
        }),
      })
    } catch (e: any) {
      toast({ title: 'Gagal update status', description: e.message, variant: 'destructive' })
      loadHafalanGrid() // rollback
    }
  }

  // FIX v2.9.3: tombol "Hafal Semua" per mufrodat (per kolom).
  // FIX v2.9.4: hapus konfirmasi dialog — langsung eksekusi sesuai request user.
  // Set SEMUA anggota jadi status='hafal' untuk materiId tertentu.
  // Pakai Promise.all untuk parallel POST — lebih cepat daripada loop serial.
  async function hafalSemuaByMateri(materiId: string, materiArabic?: string) {
    if (hafalanGrid.length === 0) return
    // Hitung berapa anggota yang masih 'belum' untuk materiId ini
    const belumCount = hafalanGrid.filter(row => {
      const cell = row.materi.find((c: any) => c.materi.id === materiId)
      return cell && cell.status === 'belum'
    }).length

    if (belumCount === 0) {
      toast({ title: 'Semua anggota sudah hafal mufrodat ini' })
      return
    }

    // FIX v2.9.4: hapus confirm() — langsung eksekusi. Toast jadi feedback.
    // FIX v2.9.5: ganti kata "menyet" → "mencentang" (kata baku).
    toast({ title: `⏳ Mencentang ${belumCount} anggota jadi hafal...` })

    // Optimistic update: set semua anggota yang 'belum' jadi 'hafal' untuk materiId ini
    setHafalanGrid(prev => prev.map(row => ({
      ...row,
      materi: row.materi.map((c: any) =>
        c.materi.id === materiId && c.status === 'belum' ? { ...c, status: 'hafal' } : c
      ),
    })))

    // POST parallel untuk semua anggota yang perlu di-update
    const updates = hafalanGrid
      .map(row => {
        const cell = row.materi.find((c: any) => c.materi.id === materiId)
        if (!cell || cell.status !== 'belum') return null
        return fetch('/api/hafalan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mahasiswaId: row.mahasiswa.id,
            materiId,
            status: 'hafal',
            centangBy: session.mahasiswa.nama,
          }),
        })
      })
      .filter(Boolean)

    try {
      await Promise.all(updates)
      toast({ title: `✅ ${belumCount} anggota di-set hafal`, description: 'Mufrodat ini sudah ditandai hafal untuk semua anggota yang sebelumnya belum' })
    } catch (e: any) {
      toast({ title: 'Gagal update sebagian', description: e.message, variant: 'destructive' })
      loadHafalanGrid() // rollback
    }
  }

  // FIX: Hapus semua fitur ingatkan/WA + belumViewData (sesuai request user)
  // Hanya simpan shareEvaluasiSemua (Salin Evaluasi)

  // FIX #3: kegiatan disimpan di DB via API /api/kegiatan
  const [kegiatanList, setKegiatanList] = useState<string[]>([])
  const [kegiatanDialogOpen, setKegiatanDialogOpen] = useState(false)
  const [customKegiatan, setCustomKegiatan] = useState('')

  // Fetch kegiatan hari ini dari API saat mount
  useEffect(() => {
    if (!session.mahasiswa?.kamar?.id) return
    fetch(`/api/kegiatan?kamarId=${session.mahasiswa.kamar.id}`)
      .then(r => r.json())
      .then(r => {
        if (r.data?.kegiatan) {
          setKegiatanList(r.data.kegiatan.split(', ').filter(Boolean))
        }
      })
      .catch(() => {})
  }, [session.mahasiswa?.kamar?.id])

  // FIX #3: save kegiatan ke API saat dialog ditutup (Selesai)
  async function saveKegiatan() {
    if (!session.mahasiswa?.kamar?.id) return
    try {
      await fetch('/api/kegiatan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kamarId: session.mahasiswa.kamar.id,
          kegiatan: kegiatanList.join(', '),
          inputBy: session.mahasiswa.nama,
        }),
      })
      toast({ title: '✅ Kegiatan tersimpan' })
    } catch {
      toast({ title: 'Gagal simpan kegiatan', variant: 'destructive' })
    }
    setKegiatanDialogOpen(false)
  }

  function shareEvaluasiSemua() {
    if (!kamarData) return
    const anggota = kamarData.anggota.map((a: any) => {
      // FIX v3.0.0: ganti "hasil tes terakhir/per tanggal" jadi "RATA-RATA skor per anggota".
      // Logic: rata-rata = sum(skorTotal semua tes yang diikuti) / totalSesiCount.
      // Sesi yang tidak diikuti dihitung sebagai 0 — kalau anggota gak ikut 1 dari 2 ujian
      // tapi dapat 100% di ujian ke-2, rata-rata = (0+100)/2 = 50% (bukan 100%).
      const rataInfo = computeRataRataAnggota(a.id)
      // FIX v2.9.5: pakai hafalanAllMateri (SEMUA materi, bukan per paket) untuk laporan.
      const row = hafalanAllMateri?.find((r: any) => r.mahasiswa.id === a.id)
      const totalMateri = row?.materi?.length || 0
      // FIX v2.9.2: pahamCount INCLUDES jumlah (jumlah = subset hafal).
      const pahamCount = row?.materi?.filter((c: any) => c.status === 'hafal' || c.status === 'jumlah').length || 0
      // FIX v2.9.6: hapus info "(Z di antaranya jumlah)" dari laporan WA. Cukup "X/Y hafal".
      // FIX v3.0.6: hapus info "(rata-rata X/Y sesi)" suffix dari status WA sesuai template user.
      // Cukup tampilkan persentase saja.
      return {
        nama: a.nama,
        nim: a.nim,
        skor: rataInfo.rata,
        // FIX v3.0.3: status format "X.X%" saja (tanpa "(rata-rata X/Y sesi)")
        status: rataInfo.totalSesi > 0
          ? `${rataInfo.rata.toFixed(1)}%`
          : 'Belum ada sesi tes',
        hafalan: `${pahamCount}/${totalMateri}`,
      }
    })
    // FIX: format baru — hapus "السلام عليكم", tambah kegiatan kamar, ganti signature
    // FIX v2.9.4: tambahkan tanggal yang dipilih di header laporan
    const tanggalStr = new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const lines = [
      '📋 *Monitoring Kamar*',
      '',
      `Kamar: ${kamarData.kamar.nama}`,
      `Ketua: ${session.mahasiswa.nama}`,
      `Tanggal: ${tanggalStr}`,
      '',
      '— Daftar Anggota —',
    ]
    anggota.forEach((a: any, i: number) => {
      // FIX v3.0.3: format sesuai template user — hapus NIM dari nama line, label "Rata-rata skor:", "Hafalan Mufrodat:"
      lines.push(`${i + 1}. ${a.nama}`)
      // FIX v3.3.5: HAPUS "Rata-rata skor" dari laporan — cuma mufrodat + kegiatan (sesuai request user)
      // lines.push(`   Rata-rata skor: ${a.status}`)  ← REMOVED
      lines.push(`   Hafalan Mufrodat: ${a.hafalan}`)
    })
    // FIX: tambah kegiatan kamar kalau ada
    if (kegiatanList.length > 0) {
      lines.push('')
      lines.push(`🎯 Kegiatan Kamar:  ${kegiatanList.join(', ')}`)
    }
    lines.push('', '— Tim Pengembangan Bahasa Ma\'had Lughah')
    const message = lines.join('\n')

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(() => {
        toast({ title: '✅ Evaluasi disalin', description: 'Paste ke WhatsApp/Telegram' })
      }).catch(() => {
        const textarea = document.createElement('textarea')
        textarea.value = message
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try { document.execCommand('copy') } catch {}
        document.body.removeChild(textarea)
        toast({ title: '✅ Evaluasi disalin' })
      })
    }
  }

  if (!session.mahasiswa?.isKetuaKamar) {
    return <EmptyState title="Bukan ketua kamar" description="Halaman ini khusus untuk ketua kamar" />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring Kamar"
        description={`Ketua Kamar ${kamarData?.kamar?.nama || ''}`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => setKegiatanDialogOpen(true)} variant="outline" className="rounded-xl bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100">
              <Plus className="w-4 h-4 mr-1.5" />
              Kegiatan
            </Button>
            <Button onClick={shareEvaluasiSemua} variant="outline" className="rounded-xl bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
              <Copy className="w-4 h-4 mr-1.5" />
              Salin Evaluasi Kamar
            </Button>
          </div>
        }
      />

      {/* FIX: Dialog Kegiatan Kamar */}
      <Dialog open={kegiatanDialogOpen} onOpenChange={setKegiatanDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle>Kegiatan Kamar</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-xs text-gray-500">Pilih kegiatan yang dilakukan hari ini. Akan muncul di output Salin Evaluasi.</p>
            <div className="flex flex-wrap gap-2">
              {['Hafal mufrodat', 'Murajaah dars', 'Musyawarah', 'Nobar', 'Absensi kamar'].map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    if (kegiatanList.includes(tag)) {
                      setKegiatanList(kegiatanList.filter(k => k !== tag))
                    } else {
                      setKegiatanList([...kegiatanList, tag])
                    }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    kegiatanList.includes(tag)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* Custom kegiatan input */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <Label className="text-xs font-semibold uppercase">Kegiatan Lain (opsional)</Label>
              <div className="flex gap-2">
                <Input
                  value={customKegiatan}
                  onChange={(e) => setCustomKegiatan(e.target.value)}
                  placeholder="Mis. Tadarus, Hadir ba'da maghrib..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customKegiatan.trim()) {
                      setKegiatanList([...kegiatanList, customKegiatan.trim()])
                      setCustomKegiatan('')
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customKegiatan.trim()) {
                      setKegiatanList([...kegiatanList, customKegiatan.trim()])
                      setCustomKegiatan('')
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {/* List kegiatan yang sudah dipilih */}
            {kegiatanList.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold mb-2">Kegiatan dipilih:</p>
                <div className="flex flex-wrap gap-1.5">
                  {kegiatanList.map((k, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs">
                      {k}
                      <button onClick={() => setKegiatanList(kegiatanList.filter((_, idx) => idx !== i))} className="text-emerald-400 hover:text-rose-500">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white rounded-b-2xl">
            <Button variant="outline" onClick={saveKegiatan} className="rounded-xl">Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 rounded-xl p-1 h-10">
          <TabsTrigger value="anggota" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
            <Users className="w-4 h-4 mr-1 inline" /> Anggota
          </TabsTrigger>
          <TabsTrigger value="hafalan" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">
            <BookOpen className="w-4 h-4 mr-1 inline" /> Hafalan
          </TabsTrigger>
          {/* FIX #3 user: hapus tab "Belum Lihat" (gabung ke "Anggota" sebagai sub-section) */}
        </TabsList>

        {/* ===== TAB: ANGGOTA KAMAR ===== */}
        <TabsContent value="anggota" className="space-y-4 mt-4">
          {loadingKamar ? <Loading /> : !kamarData ? (
            <EmptyState title="Data kamar tidak ditemukan" />
          ) : (
            <Card className="rounded-2xl border border-gray-200 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Anggota Kamar {kamarData.kamar.nama}</span>
                  <Badge variant="info">{kamarData.anggota.length} anggota</Badge>
                </CardTitle>
                {/* FIX v2.9.4: date picker untuk filter hasil tes per tanggal.
                     User minta: "per tanggal yah" — tampilkan hasil tes yang dikerjakan HARI ITU,
                     bukan hasil tes terbaru secara global. */}
                <div className="flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-200 px-3 py-1.5 text-sm rounded-lg"
                  />
                  <span className="text-xs text-gray-500 ml-1">
                    Hasil tes & login ditampilkan untuk tanggal ini
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {kamarData.anggota.map((a: any) => {
                    // FIX v3.0.0: ganti "hasil tes terakhir/per tanggal" jadi "RATA-RATA skor per anggota".
                    // Logic: rata-rata = sum(skorTotal semua tes yang diikuti) / totalSesiCount.
                    // Sesi yang tidak diikuti dihitung sebagai 0 — kalau anggota gak ikut 1 dari 2 ujian
                    // tapi dapat 100% di ujian ke-2, rata-rata = (0+100)/2 = 50% (bukan 100%).
                    const rataInfo = computeRataRataAnggota(a.id)
                    // FIX v2.9.5: hafalan summary dari SEMUA materi (bukan per paket).
                    // Pakai hafalanAllMateri yang di-load terpisah (tanpa paketId filter).
                    const row = hafalanAllMateri?.find((r: any) => r.mahasiswa.id === a.id)
                    const totalMateri = row?.materi?.length || 0
                    const pahamCount = row?.materi?.filter((c: any) => c.status === 'hafal' || c.status === 'jumlah').length || 0
                    const jumlahSubset = row?.materi?.filter((c: any) => c.status === 'jumlah').length || 0
                    return (
                    <div key={a.id} className="flex items-center justify-between p-4 hover:bg-gray-50 gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.loginToday ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{a.nama}</p>
                            {a.isKetuaKamar && <Badge variant="gold" className="text-[10px]">Ketua</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {a.loginToday
                              ? `Login hari ini${a.lastLogin ? ' · ' + new Date(a.lastLogin).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}`
                              : 'Belum login hari ini'}
                          </p>
                          {/* FIX v2.9.5: tampilkan hafalan summary per-anggota di tab Kamar. */}
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            <span className="text-emerald-600 font-semibold">{pahamCount}</span>
                            <span className="text-gray-400">/{totalMateri} hafal</span>
                            {jumlahSubset > 0 && <span className="text-blue-500"> ({jumlahSubset} jumlah)</span>}
                          </p>
                        </div>
                      </div>
                      {/* FIX v3.0.0: tampilkan RATA-RATA skor per anggota (sum/totalSesi).
                           Bukan hasil tes terakhir atau per-tanggal lagi. Sesi yang tidak diikuti = 0. */}
                      <div className="text-right ml-2 shrink-0">
                        {rataInfo.totalSesi > 0 ? (
                          <>
                            <p className="text-sm font-bold text-gray-900">{rataInfo.rata.toFixed(1)}%</p>
                            <p className="text-[10px] text-gray-500">
                              rata-rata · {rataInfo.jumlahSesiDiikuti}/{rataInfo.totalSesi} sesi
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-gray-400">Belum ada sesi tes</p>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub-section "Belum Lihat Materi" DIHAPUS TOTAL (sesuai request user) */}
        </TabsContent>

        {/* ===== TAB: MONITORING HAFALAN ===== */}
        <TabsContent value="hafalan" className="space-y-4 mt-4">
          <Card className="rounded-2xl border border-gray-200 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Monitoring Hafalan Anggota</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadHafalanGrid}
                  disabled={loadingHafalan}
                  className="rounded-lg"
                >
                  {loadingHafalan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
                </Button>
              </CardTitle>
              {/* FIX v2.9.3: hapus opsi "Semua Paket Materi" — user wajib pilih paket spesifik.
                  Default filterPaket='' (empty) → loadHafalanGrid skip fetch → empty state tampil. */}
              <div className="flex gap-2 mt-2">
                <Select value={filterPaket} onValueChange={setFilterPaket}>
                  <SelectTrigger className="w-full sm:w-64 rounded-xl h-9"><SelectValue placeholder="Pilih paket materi..." /></SelectTrigger>
                  <SelectContent>
                    {paketList.length === 0 ? (
                      <SelectItem value="_empty" disabled>Belum ada paket materi</SelectItem>
                    ) : (
                      paketList.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nama}{p.tema ? ` - ${p.tema}` : ''} ({p._count?.items || 0} item)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingHafalan ? <Loading /> : !filterPaket ? (
                <EmptyState title="Pilih paket materi dulu" description="Pilih paket di dropdown atas untuk menampilkan grid hafalan anggota" />
              ) : materiList.length === 0 ? (
                <EmptyState title="Belum ada materi di paket ini" description="Materi yang sudah dirilis akan tampil di sini untuk dicentang" />
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Klik kolom untuk centang status hafalan: <Badge variant="default" className="ml-1">belum</Badge> → <Badge variant="info" className="ml-1">Hafal</Badge> → <Badge variant="success" className="ml-1">Jumlah</Badge> (mufidah)
                  </p>
                  {/* FIX v2.9.3: tombol "Hafal Semua" per mufrodat ada di footer tabel.
                      User minta: tombol di bawah tabel, per mufrodat (bukan per nama). */}
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 border-b sticky left-0 bg-gray-50">Anggota</th>
                          {/* FIX v3.0.3: slice(0, 100) → slice(0, 500) — support 115+ materi (sebelumnya 15+ terpotong). */}
                          {materiList.slice(0, 500).map((m: any) => (
                            <th key={m.id} className="p-2 border-b min-w-[100px] text-center">
                              <div className="space-y-0.5">
                                <ArabicText size="sm" className="text-gray-900 leading-tight">{m.arabic}</ArabicText>
                                <p className="text-[10px] text-gray-500">{m.arti}</p>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hafalanGrid.map((row: any) => (
                          <tr key={row.mahasiswa.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 sticky left-0 bg-white">
                              <p className="font-medium">{row.mahasiswa.nama}</p>
                              <p className="text-[10px] text-gray-500">{row.mahasiswa.nim}</p>
                            </td>
                            {/* FIX v3.0.3: slice(0, 100) → slice(0, 500) untuk row.materi juga */}
                            {row.materi.slice(0, 500).map((cell: any) => (
                              <td key={cell.materi.id} className="p-1 text-center">
                                <button
                                  onClick={() => {
                                    const next = cell.status === 'belum' ? 'hafal'
                                      : cell.status === 'hafal' ? 'jumlah'
                                      : 'belum'
                                    updateHafalan(row.mahasiswa.id, cell.materi.id, next)
                                  }}
                                  className={`w-9 h-9 rounded-lg text-[10px] font-bold transition-all ${
                                    cell.status === 'belum' ? 'bg-gray-100 text-gray-400 hover:bg-gray-200' :
                                    cell.status === 'hafal' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                    'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  }`}
                                  title={`${cell.materi.arti} — status: ${cell.status}${cell.centangBy ? ` (oleh ${cell.centangBy})` : ''}`}
                                >
                                  {cell.status === 'belum' ? '○' : cell.status === 'hafal' ? 'H' : 'J'}
                                </button>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      {/* FIX v2.9.3: footer dengan tombol "Hafal Semua" per mufrodat (per kolom).
                           Tombol di bawah tabel, di bawah nama anggota — setiap kolom punya 1 tombol. */}
                      <tfoot>
                        <tr className="bg-emerald-50/50 border-t-2 border-emerald-200">
                          <td className="p-2 sticky left-0 bg-emerald-50/95">
                            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Hafal Semua →</p>
                          </td>
                          {materiList.slice(0, 500).map((m: any) => {
                            const belumCount = hafalanGrid.filter(row => {
                              const cell = row.materi.find((c: any) => c.materi.id === m.id)
                              return cell && cell.status === 'belum'
                            }).length
                            return (
                              <td key={m.id} className="p-1 text-center">
                                <button
                                  onClick={() => hafalSemuaByMateri(m.id, m.arabic)}
                                  disabled={belumCount === 0}
                                  className={`w-full h-7 rounded text-[9px] font-bold transition-all ${
                                    belumCount === 0
                                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                      : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
                                  }`}
                                  title={belumCount === 0
                                    ? 'Semua anggota sudah hafal mufrodat ini'
                                    : `Set ${belumCount} anggota yang masih 'belum' jadi 'hafal' untuk mufrodat ${m.arti}`
                                  }
                                >
                                  {belumCount === 0 ? '✓' : `Hafal ${belumCount}`}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Menampilkan {Math.min(materiList.length, 100)} mufrodat (maks 100). Total di paket: {materiList.length}.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB: BELUM LIHAT MATERI — GABUNG KE TAB ANGGOTA (FIX #3 user) ===== */}
        {/* Tab "Belum Lihat" sudah digabung ke tab "Anggota" sebagai sub-section di bawah */}

      </Tabs>
    </div>
  )
}
