'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { EmptyState, Loading, StatCard, PageHeader, Badge } from '@/components/shared'
import { getGrade } from '@/components/shared/grade'
import { toast } from '@/hooks/use-toast'
import { Users, BookOpen, FileText, TrendingUp, ArrowUpRight, Clock, CheckCircle2, AlertCircle, LogIn, UserCheck, UserX, Clipboard, ClipboardCheck, ListChecks, Package } from 'lucide-react'

export function DashboardView() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<any>(null)
  const [byKamar, setByKamar] = useState<any[]>([])
  const [sesiList, setSesiList] = useState<any[]>([])
  // FIX: rubah 'login atau tidak' jadi 'status pengerjaan soal' (sesi aktif terbaru)
  const [soalSummary, setSoalSummary] = useState<{ totalMahasiswa: number; sudahKerja: number; belumKerja: number; sesiAktif: any } | null>(null)
  const [belumKerjaList, setBelumKerjaList] = useState<any[]>([])
  const [showBelumKerja, setShowBelumKerja] = useState(false)
  // FIX v2.9.8: state hafalan per kamar untuk graph "Progres Hafalan Mufrodat per Kamar"
  const [hafalanByKamar, setHafalanByKamar] = useState<any[]>([])

  // FIX v3.4.1: store RAW hafalan data for client-side filtering (no re-fetch when paket changes)
  const [rawHafalanKamars, setRawHafalanKamars] = useState<any[]>([])
  const [rawHafalanMap, setRawHafalanMap] = useState<Record<string, any>>({})
  const [materiByPaket, setMateriByPaket] = useState<Record<string, string[]>>({})

  // FIX v3.0.2: state untuk filter sesi (Pilih Ujian) + paket (Pilih Paket Materi).
  // Default: semua sesi/paket terceklis. User bisa batasi grafik ke ujian/paket spesifik.
  const [allHasil, setAllHasil] = useState<any[]>([])          // semua hasil tes records (untuk compute distribusi real)
  const [allSesiList, setAllSesiList] = useState<any[]>([])    // list semua sesi (untuk checklist)
  const [selectedSesiIds, setSelectedSesiIds] = useState<Set<string>>(new Set())
  const [showSesiPicker, setShowSesiPicker] = useState(false)

  const [allPaketList, setAllPaketList] = useState<any[]>([])  // list semua paket (untuk checklist)
  const [selectedPaketIds, setSelectedPaketIds] = useState<Set<string>>(new Set())
  const [showPaketPicker, setShowPaketPicker] = useState(false)

  useEffect(() => {
    // FIX: ambil sesi aktif terbaru + cek siapa yang sudah/belum kerja
    Promise.allSettled([
      fetch('/api/hasil?action=overview').then(r => r.json()),
      fetch('/api/hasil?action=by-kamar').then(r => r.json()),
      fetch('/api/sesi?aktif=true').then(r => r.json()),
      // FIX v2.9.8: fetch hafalan summary semua kamar untuk graph persentase hafalan mufrodat
      fetch(`/api/kegiatan?action=summary&date=${new Date().toISOString().slice(0, 10)}&lantai=all`).then(r => r.json()),
      // FIX v3.0.2: fetch semua hasil tes (with skorTotal) untuk compute distribusi REAL
      fetch('/api/hasil?action=all').then(r => r.json()),
      // FIX v3.0.2: fetch list semua sesi (tidak hanya aktif) untuk checklist Pilih Ujian
      fetch('/api/sesi').then(r => r.json()),
      // FIX v3.0.2: fetch list semua paket materi untuk checklist Pilih Paket
      fetch('/api/paket-materi').then(r => r.json()),
    ]).then(async (results) => {
      const [ov, bk, sl, hfl, allH, allS, allP] = results.map(r => r.status === 'fulfilled' ? r.value : null)
      setOverview(ov?.data || null)
      const sortedByKamar = (bk?.data || []).slice().sort((a: any, b: any) =>
        String(a.nama).localeCompare(String(b.nama))
      )
      setByKamar(sortedByKamar)
      setSesiList(sl?.data || [])

      // FIX v3.0.2: simpan allHasil (flat array hasil tes records) untuk compute distribusi real
      const flatAllHasil = allH?.data || []
      setAllHasil(flatAllHasil)
      // Default: semua sesi terceklis
      const allSesiListData = (allS?.data || []).filter((s: any) => s.tanggalMulai) // hanya yang punya tanggalMulai
      setAllSesiList(allSesiListData)
      setSelectedSesiIds(new Set(allSesiListData.map((s: any) => s.id)))

      // FIX v3.0.2: simpan list paket untuk checklist
      const allPaketListData = (allP?.data || [])
      setAllPaketList(allPaketListData)
      setSelectedPaketIds(new Set(allPaketListData.map((p: any) => p.id)))

      // FIX v2.9.8: build hafalanByKamar data untuk graph
      const kamars = hfl?.data?.kamars || []
      const hafalanMap = hfl?.data?.hafalanMap || {}

      // FIX v3.4.1: store RAW data for client-side filtering (no re-fetch when paket changes)
      setRawHafalanKamars(kamars)
      setRawHafalanMap(hafalanMap)

      // FIX v3.4.1: fetch all materi to build paketId → materiIds mapping
      // (for client-side filtering when user checks/unchecks pakets)
      try {
        const materiRes = await fetch('/api/materi?take=500').then(r => r.json())
        const allMateri = materiRes?.data || []
        const mapping: Record<string, string[]> = {}
        for (const m of allMateri) {
          if (m.paketId) {
            if (!mapping[m.paketId]) mapping[m.paketId] = []
            mapping[m.paketId].push(m.id)
          }
        }
        setMateriByPaket(mapping)
      } catch {}

      const hafalanData = kamars.map((k: any) => {
        const h = hafalanMap[k.id] || { hafal: 0, jumlah: 0, total: 0, anggota: 0 }
        const persen = (h.total || 0) > 0 ? ((h.hafal || 0) / h.total) * 100 : 0
        return {
          nama: k.nama,
          persen: Number(persen.toFixed(1)),
          hafal: h.hafal || 0,
          total: h.total || 0,
          anggota: h.anggota || 0,
        }
      }).sort((a: any, b: any) => String(a.nama).localeCompare(String(b.nama)))
      setHafalanByKamar(hafalanData)

      // Ambil sesi aktif terbaru (paling atas list, sort by tanggalMulai desc)
      const sesiAktifList = sl?.data || []
      const sesiAktif = sesiAktifList[0] // sesi terbaru
      if (sesiAktif) {
        // Hitung siapa yang sudah kerja di sesi itu
        const sk = await fetch(`/api/sesi?action=belum-kerja&id=${sesiAktif.id}`).then(r => r.json()).catch(() => ({ data: [] }))
        const belumKerjaCount = sk.data?.length || 0
        const totalMhs = ov?.data?.totalMhs || 0
        setSoalSummary({
          totalMahasiswa: totalMhs,
          sudahKerja: totalMhs - belumKerjaCount,
          belumKerja: belumKerjaCount,
          sesiAktif,
        })
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // FIX v3.4.1: CLIENT-SIDE filtering — NO re-fetch API when paket changes!
  // Sebelumnya: useEffect → fetch API (5 DB queries) setiap kali user uncheck paket → LAMBAT
  // Sekarang: useMemo → recompute dari raw data yang sudah di-store → INSTANT (<5ms)
  // Data raw (rawHafalanMap) berisi per-kamar → per-anggota → per-materi grid dengan status
  // materiByPaket mapping: paketId → [materiId, ...] untuk filter materi yang dipilih
  const hafalanByKamarFiltered = useMemo(() => {
    if (rawHafalanKamars.length === 0 || Object.keys(rawHafalanMap).length === 0) return []
    if (Object.keys(materiByPaket).length === 0) return hafalanByKamar // fallback ke data awal

    // Build set of selected materiIds dari selectedPaketIds
    const selectedMateriIds = new Set<string>()
    for (const paketId of selectedPaketIds) {
      const ids = materiByPaket[paketId] || []
      ids.forEach(id => selectedMateriIds.add(id))
    }

    // Kalau semua paket terceklis → gunakan data asli (sudah di-compute di server)
    if (selectedPaketIds.size === allPaketList.length) return hafalanByKamar

    // Kalau gak ada paket terceklis → semua 0%
    if (selectedMateriIds.size === 0) {
      return rawHafalanKamars.map((k: any) => ({
        nama: k.nama,
        persen: 0,
        hafal: 0,
        total: 0,
        anggota: 0,
      })).sort((a: any, b: any) => String(a.nama).localeCompare(String(b.nama)))
    }

    // Recompute per kamar dari raw data
    return rawHafalanKamars.map((k: any) => {
      const h = rawHafalanMap[k.id]
      if (!h || !h.rows) {
        return { nama: k.nama, persen: 0, hafal: 0, total: 0, anggota: 0 }
      }
      let totalHafal = 0
      let totalMateri = 0
      for (const row of h.rows) {
        for (const cell of row.materi) {
          // FIX: hanya hitung materi yang ada di selectedMateriIds
          if (selectedMateriIds.has(cell.materiId)) {
            totalMateri++
            if (cell.status === 'hafal' || cell.status === 'jumlah') totalHafal++
          }
        }
      }
      const persen = totalMateri > 0 ? (totalHafal / totalMateri) * 100 : 0
      return {
        nama: k.nama,
        persen: Number(persen.toFixed(1)),
        hafal: totalHafal,
        total: totalMateri,
        anggota: h.anggota || 0,
      }
    }).sort((a: any, b: any) => String(a.nama).localeCompare(String(b.nama)))
  }, [rawHafalanKamars, rawHafalanMap, materiByPaket, selectedPaketIds, allPaketList, hafalanByKamar])

  // FIX v3.0.2: compute distribusi REAL dari allHasil + filter by selectedSesiIds.
  // Sebelumnya pakai fake estimate (Math.round(totalHasil * 0.15) dll) yang bisa menghasilkan
  // angka negatif kalau total kecil → user lihat "-45" untuk ضعيف (F, <50%).
  const filteredHasil = useMemo(() => {
    if (selectedSesiIds.size === 0) return []
    return allHasil.filter(h => selectedSesiIds.has(h.sesiId))
  }, [allHasil, selectedSesiIds])

  // FIX v3.0.2: compute byKamar filtered (rata-rata skor per kamar, filtered by selected sesi)
  const filteredByKamar = useMemo(() => {
    if (filteredHasil.length === 0) return []
    const grouped: Record<string, { nama: string; total: number; count: number }> = {}
    for (const h of filteredHasil) {
      const k = h.mahasiswa?.kamar
      if (!k) continue
      if (!grouped[k.id]) grouped[k.id] = { nama: k.nama, total: 0, count: 0 }
      grouped[k.id].total += (h.skorTotal || 0)
      grouped[k.id].count += 1
    }
    return Object.entries(grouped).map(([id, v]) => ({
      id,
      nama: v.nama,
      avg: v.count > 0 ? Number((v.total / v.count).toFixed(1)) : 0,
      count: v.count,
    })).sort((a, b) => String(a.nama).localeCompare(String(b.nama)))
  }, [filteredHasil])

  // FIX v3.0.2: compute distribusi REAL — hitung hasil per grade pakai getGrade() helper.
  // FIX v3.0.3: juga hitung mahasiswa yang GAK IKUT ujian — sebelumnya sebagai F (ضعيف).
  // FIX v3.0.4: pisahkan mhs gak ikut ke predikat SENDIRI = غائب (Ghaib = absent).
  // Riset web search: غائب (gha'ib) = present participle "absent", istilah paling cocok
  // untuk siswa gak ikut ujian dalam konteks pendidikan Arab. Berbeda dari ضعيف (F = skor rendah).
  // Sekarang distribusi ada 6 kategori: A, B, C, D, F (untuk yang ikut), GHAIB (untuk yang gak ikut).
  const distribusi = useMemo(() => {
    const counts: Record<string, { value: number; color: string; arabic: string; letter: string; range: string }> = {
      'A': { value: 0, color: '#10B981', arabic: 'ممتاز', letter: 'A', range: '≥90%' },
      'B': { value: 0, color: '#3B82F6', arabic: 'جيد جداً', letter: 'B', range: '80-89%' },
      'C': { value: 0, color: '#F59E0B', arabic: 'جيد', letter: 'C', range: '65-79%' },
      'D': { value: 0, color: '#F97316', arabic: 'مقبول', letter: 'D', range: '50-64%' },
      'F': { value: 0, color: '#EF4444', arabic: 'ضعيف', letter: 'F', range: '<50%' },
      // FIX v3.0.4: predikat baru untuk mhs yang GAK IKUT ujian (skor 0 tapi beda kategori dari F).
      'GHAIB': { value: 0, color: '#9CA3AF', arabic: 'غائب', letter: '∅', range: 'tidak ikut' },
    }
    // 1. Count hasil tes yang ADA di filteredHasil (mhs yang ikut)
    for (const h of filteredHasil) {
      const skor = h.skorTotal || 0
      const grade = getGrade(skor)
      if (counts[grade.letter]) {
        counts[grade.letter].value++
      }
    }
    // 2. FIX v3.0.4: tambahkan mhs yang GAK IKUT tiap sesi terpilih sebagai GHAIB (bukan F lagi).
    // Misal: 245 mhs, sesi A hanya 50 hasil → 195 mhs gak ikut → counts.GHAIB += 195.
    const totalMhs = overview?.totalMhs || 0
    if (totalMhs > 0) {
      const sesiIds = Array.from(selectedSesiIds)
      for (const sesiId of sesiIds) {
        const hasilCount = filteredHasil.filter(h => h.sesiId === sesiId).length
        const belumKerja = Math.max(0, totalMhs - hasilCount)
        if (belumKerja > 0) counts.GHAIB.value += belumKerja
      }
    }
    return Object.values(counts).map(c => ({
      name: `${c.arabic} (${c.letter}, ${c.range})`,
      ...c,
    }))
  }, [filteredHasil, selectedSesiIds, overview])

  // Total hasil filtered (untuk persentase) — FIX v3.0.3: sekarang termasuk mhs yang gak ikut.
  // total = (jumlah hasil tes yang ada) + (jumlah mhs × sesi - jumlah hasil tes) = totalMhs × sesiCount
  const totalFilteredHasil = useMemo(() => {
    const totalMhs = overview?.totalMhs || 0
    const sesiCount = selectedSesiIds.size
    if (totalMhs === 0 || sesiCount === 0) return filteredHasil.length
    return totalMhs * sesiCount
  }, [filteredHasil.length, selectedSesiIds, overview])

  // FIX v3.0.4: compute "Salin Evaluasi Ujian" WA message — format sesuai template user.
  // Tombol di header Distribusi Skor (atau Rata-rata Skor) — klik → copy clipboard.
  function salinEvaluasiUjian() {
    const totalMhs = overview?.totalMhs || 0
    const sesiCount = selectedSesiIds.size
    const hasilTercatat = filteredHasil.length
    if (sesiCount === 0) {
      toast({ title: 'Pilih ujian dulu', variant: 'destructive' })
      return
    }
    // Ambil sesi yang terceklis untuk tanggal/jam periode
    const selectedSesiList = allSesiList.filter(s => selectedSesiIds.has(s.id))
    const firstSesi = selectedSesiList[0]
    // Periode = bulan+tahun dari tanggalMulai sesi pertama
    const periodeDate = firstSesi?.tanggalMulai ? new Date(firstSesi.tanggalMulai) : new Date()
    const periodeStr = periodeDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    // Tanggal ujian format: "Ahad, 18 Oktober 2026 Pukul 20.30-22.30 Wita"
    let tanggalUjianStr = 'tanggal tidak tersedia'
    if (firstSesi?.tanggalMulai) {
      const d = new Date(firstSesi.tanggalMulai)
      const hariStr = d.toLocaleDateString('id-ID', { weekday: 'long' })
      const tglStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      const jamStr = firstSesi.jamMulai
        ? `Pukul ${firstSesi.jamMulai}${firstSesi.jamSelesai ? `-${firstSesi.jamSelesai}` : ''} Wita`
        : ''
      tanggalUjianStr = `${hariStr}, ${tglStr}${jamStr ? ` ${jamStr}` : ''}`
    }
    // Multiple sesi → gabung tanggal
    if (selectedSesiList.length > 1) {
      tanggalUjianStr = `${selectedSesiList.length} sesi ujian (${selectedSesiList.map(s => new Date(s.tanggalMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })).join(', ')})`
    }

    // Distribusi grades (5 grades A,B,C,D,F + GHAIB)
    const distribusiMap = distribusi.reduce((acc: Record<string, any>, d: any) => {
      acc[d.letter] = d
      return acc
    }, {})
    const totalDataPoints = totalMhs * sesiCount
    const ghaibCount = distribusiMap['GHAIB']?.value || 0
    const persen = (val: number) => totalDataPoints > 0 ? ((val / totalDataPoints) * 100).toFixed(1) : '0'

    // Tambahan: persen mhs yang skor >= 80 (dari hasil tes yang ada)
    const lulus80 = filteredHasil.filter(h => (h.skorTotal || 0) >= 80).length
    const persen80 = hasilTercatat > 0 ? ((lulus80 / hasilTercatat) * 100).toFixed(1) : '0'
    const perluBinaan = filteredHasil.filter(h => (h.skorTotal || 0) < 80).length

    const lines = [
      '*📊 LAPORAN HASIL UJIAN MUFRADAT LEVEL 1- MA\'HAD LUGHA IAI STIBA MAKASSAR*',
      '',
      `📅 Periode: ${periodeStr}`,
      '',
      `Berdasarkan hasil Ujian Mufradat Level 1 yg di laksanakan pada (${tanggalUjianStr}) berikut rekapitulasi hasil ujian:`,
      '',
      `👥 Total Mahasiswa: ${totalMhs} orang`,
      `📝 Hasil ujian tercatat: ${hasilTercatat} mahasiswa`,
      '',
      '🏆 Distribusi Hasil Ujian: ',
      '',
      `🟢 Mumtaz (A): ${distribusiMap['A']?.value || 0} mahasiswa (${persen(distribusiMap['A']?.value || 0)}%)`,
      `🔵 Jiddan Jiddan (B): ${distribusiMap['B']?.value || 0} mahasiswa (${persen(distribusiMap['B']?.value || 0)}%)`,
      `🟡 Jayyid (C): ${distribusiMap['C']?.value || 0} mahasiswa (${persen(distribusiMap['C']?.value || 0)}%)`,
      `🟠 Maqbul (D): ${distribusiMap['D']?.value || 0} mahasiswa (${persen(distribusiMap['D']?.value || 0)}%)`,
      `🔴 Dha'if (F): ${distribusiMap['F']?.value || 0} mahasiswa (${persen(distribusiMap['F']?.value || 0)}%)`,
      `⚫ Ghaib (غائب): ${ghaibCount} mahasiswa (${persen(ghaibCount)}%)`,
      '',
      `📌 Catatan Evaluasi: Dari ${totalDataPoints} data points yang seharusnya (total mhs × sesi ujian), sebanyak ${hasilTercatat} mahasiswa telah tercatat dalam hasil ujian, sedangkan *${ghaibCount} mahasiswa lainnya belum mengikuti ujian (tercatat sebagai غائب)*`,
      '',
      `Dari peserta yang nilainya tercatat, ${persen80}% memperoleh nilai minimal 80. Adapun ${perluBinaan} mahasiswa masih memerlukan pembinaan dan penguatan penguasaan mufradat.`,
      '',
      '_____',
      '✍🏻*Div. Pengembangan Bahasa Ma\'had Lughah*',
    ]

    const message = lines.join('\n')
    // FIX v3.2.0: pakai clipboard only (hapus .txt download fallback — user mau salin, bukan download)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(() => {
        toast({ title: '✅ Laporan hasil ujian disalin', description: 'Tempel ke grup WhatsApp' })
      }).catch(() => {
        // Fallback: textarea + execCommand('copy') — pakai cara lama kalau clipboard API ditolak
        const ta = document.createElement('textarea')
        ta.value = message
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch {}
        document.body.removeChild(ta)
        toast({ title: '✅ Laporan hasil ujian disalin' })
      })
    } else {
      // Browser sangat lama — pakai textarea + execCommand
      const ta = document.createElement('textarea')
      ta.value = message
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      toast({ title: '✅ Laporan hasil ujian disalin' })
    }
  }

  async function loadBelumKerja() {
    if (showBelumKerja) {
      setShowBelumKerja(false)
      return
    }
    if (!soalSummary?.sesiAktif) return
    const r = await fetch(`/api/sesi?action=belum-kerja&id=${soalSummary.sesiAktif.id}`).then(r => r.json())
    setBelumKerjaList(r.data || [])
    setShowBelumKerja(true)
  }

  async function salinNamaBelumIsi() {
    if (!soalSummary?.sesiAktif) {
      // Fallback kalau gak ada sesi aktif — pakai belum login
      const r = await fetch('/api/tracking?action=belum-login-hari-ini').then(r => r.json())
      const list = r.data || []
      if (list.length === 0) return
      const text = list.map((m: any) => `${m.nama} (${m.kamar?.nama || '-'})`).join(', ')
      copyToClipboard(text, list.length)
      return
    }
    const r = await fetch(`/api/sesi?action=belum-kerja&id=${soalSummary.sesiAktif.id}`).then(r => r.json())
    const list = r.data || []
    if (list.length === 0) return
    const text = list.map((m: any) => `${m.nama} (${m.kamar?.nama || '-'})`).join(', ')
    copyToClipboard(text, list.length)
  }

  function copyToClipboard(text: string, count: number) {
    navigator.clipboard?.writeText(text).then(() => {
      // Silent (tanpa toast). Skip console.log di production untuk bersihkan devtools.
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`✅ ${count} nama disalin ke clipboard`)
      }
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    })
  }

  if (loading) return <Loading />
  if (!overview) return <EmptyState title="Belum ada data" description="Mulai dengan menambah mahasiswa dan materi" />

  // FIX v3.0.2: distribusi sekarang REAL — di-compute di useMemo atas dari allHasil (filtered by selectedSesiIds).
  // Hapus blok fake estimate (Math.round(totalHasil * 0.15) dll) yang bisa negatif.
  const avgScore = overview.avgScore || 0

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" description="Ringkasan aktivitas Ma'had Lughah" />

      {/* FIX v2.9.8: 5 stat cards dalam SATU baris (compact). Sebelumnya: Pengerjaan Tes
          col-span-2 → total 6 col slots di grid lg:grid-cols-5 → card ke-5 wrap ke baris baru.
          Sekarang: hapus col-span-2, semua card setara (1 col slot masing). Grid pakai
          grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 supaya responsive. Card lebih compact
          (padding dikurangi, text size dikurangi). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
        {/* Status Pengerjaan Tes (compact) */}
        {soalSummary ? (
          <div className="border border-gray-200 bg-white p-3 rounded-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 truncate">
              Pengerjaan Tes
            </p>
            <p className="text-xs font-bold text-gray-900 mb-2 truncate" title={soalSummary.sesiAktif?.nama || 'Sesi Terbaru'}>
              {soalSummary.sesiAktif?.nama || 'Sesi Terbaru'}
            </p>
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center">
                <p className="text-base font-bold text-gray-700 leading-none">{soalSummary.sudahKerja}</p>
                <p className="text-[8px] text-gray-500 mt-0.5">Sudah</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-rose-600 leading-none">{soalSummary.belumKerja}</p>
                <p className="text-[8px] text-gray-500 mt-0.5">Belum</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-700 leading-none">{soalSummary.totalMahasiswa}</p>
                <p className="text-[8px] text-gray-500 mt-0.5">Total</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Stat cards compact — semua setara, no col-span */}
        <div className="border border-gray-200 bg-gray-900 text-white p-3 rounded-xl">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Mahasiswa</p>
          <p className="text-xl font-bold mt-0.5 leading-none">{overview.totalMhs}</p>
          <p className="text-[9px] text-gray-400 mt-1">{overview.totalKamar} kamar</p>
        </div>
        <div className="border border-gray-200 bg-white p-3 rounded-xl">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sesi Tes</p>
          <p className="text-xl font-bold mt-0.5 text-gray-900 leading-none">{overview.totalSesi}</p>
          <p className="text-[9px] text-gray-500 mt-1">{overview.totalHasil} hasil</p>
        </div>
        <div className="border border-gray-200 bg-white p-3 rounded-xl">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Materi</p>
          <p className="text-xl font-bold mt-0.5 text-gray-900 leading-none">{overview.totalMateri}</p>
          <p className="text-[9px] text-gray-500 mt-1">mufrodat + tarkib</p>
        </div>
        <div className="border border-gray-200 bg-white p-3 rounded-xl">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rata-rata Skor</p>
          <p className="text-xl font-bold mt-0.5 text-gray-900 leading-none">{avgScore.toFixed(1)}%</p>
          <p className="text-[9px] text-gray-500 mt-1">dari semua hasil</p>
        </div>
      </div>

      {/* Login Harian Panel LAMA — sudah diganti dengan "Status Pengerjaan Soal" di atas */}

      {/* Charts row: bar (2-col) + donut (1-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border border-gray-200 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Rata-rata Skor per Kamar</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {/* FIX v3.0.2: tampilkan info filter sesi yang dipilih */}
                {selectedSesiIds.size === allSesiList.length
                  ? 'Semua ujian' : `${selectedSesiIds.size}/${allSesiList.length} ujian dipilih`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* FIX v3.0.2: tombol "Pilih Ujian" — buka dialog checklist sesi */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSesiPicker(true)}
                className="rounded-xl h-8 text-xs"
              >
                <ListChecks className="w-3.5 h-3.5 mr-1" /> Pilih Ujian
              </Button>
              {/* FIX v3.0.4: tombol "Salin Evaluasi Ujian" — copy WA message format template user */}
              <Button
                size="sm"
                onClick={salinEvaluasiUjian}
                disabled={selectedSesiIds.size === 0}
                className="rounded-xl h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                title="Salin laporan hasil ujian format WhatsApp"
              >
                <ClipboardCheck className="w-3.5 h-3.5 mr-1" /> Salin Laporan Ujian
              </Button>
              <Badge variant="success">
                <ArrowUpRight className="w-3 h-3 mr-1 inline" />
                {filteredByKamar.length} kamar
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* FIX v3.0.2: tinggi chart 500 → 380 (lebih compact sesuai request user).
                Label XAxis vertical tetap muat karena height=80. */}
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={filteredByKamar} margin={{ top: 16, right: 16, bottom: 80, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="nama"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-90}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Rata-rata']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]} fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-200 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribusi Skor</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {/* FIX v3.0.2: tampilkan info total hasil yang dihitung (filtered by sesi) */}
              {totalFilteredHasil} hasil · {selectedSesiIds.size === allSesiList.length ? 'semua ujian' : `${selectedSesiIds.size} ujian`}
            </p>
          </CardHeader>
          <CardContent>
            {/* FIX v3.0.2: tinggi 300 → 380 match dengan bar chart */}
            <ResponsiveContainer width="100%" height={380}>
              <PieChart>
                <Pie
                  data={distribusi}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry: any) => entry.value > 0 ? entry.value : ''}  // FIX v3.0.2: tampilkan count real di slice
                >
                  {distribusi.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  // FIX v3.0.2: tooltip tampilkan count + persentase real
                  formatter={(v: any, n: any) => {
                    const persen = totalFilteredHasil > 0 ? ((Number(v) / totalFilteredHasil) * 100).toFixed(1) : '0'
                    return [`${v} hasil (${persen}%)`, n]
                  }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  // FIX v3.0.2: legend tampilkan count + persen per grade
                  formatter={(v: any) => {
                    const item = distribusi.find(d => d.name === v)
                    if (!item) return <span className="text-xs text-gray-600">{v}</span>
                    const persen = totalFilteredHasil > 0 ? ((item.value / totalFilteredHasil) * 100).toFixed(1) : '0'
                    return <span className="text-xs text-gray-600">{v}: <b>{item.value}</b> ({persen}%)</span>
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* FIX v2.9.8: graph baru "Progres Hafalan Mufrodat per Kamar" (persentase).
          FIX v3.0.2: tambah tombol "Pilih Paket Materi" untuk filter grafik ini.
          Tinggi chart 500 → 380 (compact, match dengan chart lain). */}
      <Card className="rounded-2xl border border-gray-200 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Progres Hafalan Mufrodat per Kamar</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {/* FIX v3.0.2: tampilkan info filter paket */}
              {selectedPaketIds.size === allPaketList.length
                ? 'Semua paket materi' : `${selectedPaketIds.size}/${allPaketList.length} paket dipilih`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* FIX v3.0.2: tombol "Pilih Paket Materi" */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPaketPicker(true)}
              className="rounded-xl h-8 text-xs"
            >
              <Package className="w-3.5 h-3.5 mr-1" /> Pilih Paket
            </Button>
            <Badge variant="info">
              <BookOpen className="w-3 h-3 mr-1 inline" />
              {hafalanByKamarFiltered.length} kamar
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* FIX v3.0.2: tinggi 500 → 380 (compact sesuai request user) */}
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={hafalanByKamarFiltered} margin={{ top: 16, right: 16, bottom: 80, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="nama"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                angle={-90}
                textAnchor="end"
                interval={0}
                height={80}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                formatter={(v: any, _n: any, p: any) => {
                  const row = p?.payload
                  return [`${Number(v).toFixed(1)}% (${row?.hafal || 0}/${row?.total || 0} mufrodat)`, 'Progres Hafal']
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, padding: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="persen" radius={[8, 8, 0, 0]} fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* FIX v2.9.8: hapus section "Sesi Tes Aktif & Riwayat" di bagian bawah dashboard.
          User minta dihapus — info ini bisa diakses lewat menu "Sesi Tes" di sidebar.
          Sebelumnya: card dengan grid list semua sesi ujian (berat render + duplikasi nav). */}

      {/* ====== FIX v3.0.2: Dialog Pilih Ujian (filter bar chart skor + donut distribusi) ====== */}
      <Dialog open={showSesiPicker} onOpenChange={setShowSesiPicker}>
        <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 max-h-[80vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-600" />
              Pilih Ujian/Tes untuk Grafik
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Centang ujian yang ingin dihitung untuk grafik "Rata-rata Skor per Kamar" + "Distribusi Skor". Default: semua terceklis.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {selectedSesiIds.size} dari {allSesiList.length} ujian terceklis
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setSelectedSesiIds(new Set(allSesiList.map(s => s.id)))}
                  className="rounded-lg h-7 text-xs"
                >
                  Centang Semua
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setSelectedSesiIds(new Set())}
                  className="rounded-lg h-7 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Kosongkan
                </Button>
              </div>
            </div>
            {allSesiList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada sesi ujian</p>
            ) : (
              allSesiList.map(s => {
                const checked = selectedSesiIds.has(s.id)
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${checked ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedSesiIds(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(s.id)
                          else next.delete(s.id)
                          return next
                        })
                      }}
                      className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.nama}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(s.tanggalMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {s.jamMulai && ` · ${s.jamMulai}${s.jamSelesai ? `-${s.jamSelesai}` : ''}`}
                        {' · '}{s._count?.hasil ?? 0} hasil
                      </p>
                    </div>
                    {s.aktif && <Badge variant="success" className="text-[10px]">Aktif</Badge>}
                  </label>
                )
              })
            )}
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white">
            <Button onClick={() => setShowSesiPicker(false)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== FIX v3.0.2: Dialog Pilih Paket Materi (filter progres hafalan graph) ====== */}
      <Dialog open={showPaketPicker} onOpenChange={setShowPaketPicker}>
        <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 max-h-[80vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              Pilih Paket Materi untuk Grafik Hafalan
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Centang paket yang ingin dihitung untuk grafik "Progres Hafalan Mufrodat per Kamar". Default: semua terceklis.
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {selectedPaketIds.size} dari {allPaketList.length} paket terceklis
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setSelectedPaketIds(new Set(allPaketList.map(p => p.id)))}
                  className="rounded-lg h-7 text-xs"
                >
                  Centang Semua
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setSelectedPaketIds(new Set())}
                  className="rounded-lg h-7 text-xs text-rose-600 hover:bg-rose-50"
                >
                  Kosongkan
                </Button>
              </div>
            </div>
            {allPaketList.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Belum ada paket materi</p>
            ) : (
              allPaketList.map(p => {
                const checked = selectedPaketIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${checked ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedPaketIds(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(p.id)
                          else next.delete(p.id)
                          return next
                        })
                      }}
                      className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.nama}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.tema ? `${p.tema} · ` : ''}{p._count?.items ?? 0} item
                        {p.tanggalRilis ? ` · rilis ${new Date(p.tanggalRilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
                      </p>
                    </div>
                    {p.pekan && <Badge variant="gold" className="text-[10px]">Pekan {p.pekan}</Badge>}
                  </label>
                )
              })
            )}
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white">
            <Button onClick={() => setShowPaketPicker(false)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
