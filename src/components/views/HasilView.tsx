'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, Download, Printer, Edit2, Plus, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ArabicText, EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { getGrade } from '@/components/shared/grade'

export function HasilView() {
  const [loading, setLoading] = useState(true)
  const [sesiList, setSesiList] = useState<any[]>([])
  const [selectedSesi, setSelectedSesi] = useState<string>('')
  // FIX v3.0.8: allData sekarang struktur { sesi, mahasiswa: [{ mahasiswa, hasil }] } dari API by-sesi-all
  // Sebelumnya: array of hasil tes (cuma mhs yang ikut). Sekarang: SEMUA mhs + hasil (kalau ada).
  const [allData, setAllData] = useState<any>(null)
  const [byMateri, setByMateri] = useState<any[]>([])
  const [crossTab, setCrossTab] = useState<any>(null)
  const [searchMhs, setSearchMhs] = useState('')
  // FIX v3.0.8 #2: filter status baru — Semua | submitted | graded | ongoing | tidak_ikut
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // FIX v3.0.8 #1: state untuk Edit Nilai dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMhs, setEditingMhs] = useState<any | null>(null)
  const [manualGrade, setManualGrade] = useState('')
  const [manualNote, setManualNote] = useState('')

  // FIX v3.1.0: state untuk Tambah Hasil Ujian manual dialog
  const [tambahDialogOpen, setTambahDialogOpen] = useState(false)
  const [tambahNim, setTambahNim] = useState('')
  const [tambahMhsFound, setTambahMhsFound] = useState<any | null>(null)
  const [tambahSkor, setTambahSkor] = useState('')
  const [tambahSelesai, setTambahSelesai] = useState(new Date().toISOString().slice(0, 16))
  const [tambahCatatan, setTambahCatatan] = useState('')
  const [tambahLoading, setTambahLoading] = useState(false)

  async function load() {
    setLoading(true)
    const sl = await fetch('/api/sesi').then(r => r.json())
    setSesiList(sl.data || [])
    if (sl.data && sl.data.length > 0 && !selectedSesi) {
      setSelectedSesi(sl.data[0].id)
    }
    setLoading(false)
  }

  async function loadData() {
    if (!selectedSesi) return
    setLoading(true)
    // FIX v3.0.8: pakai action=by-sesi-all supaya SEMUA mhs tampil (termasuk yang gak ikut).
    const [all, bm, ct] = await Promise.all([
      fetch(`/api/hasil?action=by-sesi-all&sesiId=${selectedSesi}`).then(r => r.json()),
      fetch(`/api/hasil?action=by-materi&sesiId=${selectedSesi}`).then(r => r.json()),
      fetch(`/api/hasil?action=cross-tab&sesiId=${selectedSesi}`).then(r => r.json()),
    ])
    setAllData(all.data || null)
    setByMateri(bm.data || [])
    setCrossTab(ct.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (selectedSesi) loadData() }, [selectedSesi])

  // FIX v3.0.8: derive allHasil array from allData (mahasiswa list with hasil)
  // Sama seperti sebelumnya tapi sekarang include mhs yang gak ikut (hasil = null)
  const allMahasiswaList = allData?.mahasiswa || []
  const allHasil = allMahasiswaList.map((m: any) => ({
    id: m.hasil?.id || m.mahasiswa.id,
    mahasiswa: m.mahasiswa,
    status: m.hasil?.status || 'tidak_ikut',
    skorTotal: m.hasil?.manualGrade !== null && m.hasil?.manualGrade !== undefined
      ? m.hasil.manualGrade
      : m.hasil?.skorTotal,
    jumlahBenar: m.hasil?.jumlahBenar || 0,
    jumlahSoal: m.hasil?.jumlahSoal || 0,
    selesai: m.hasil?.selesai,
    manualGrade: m.hasil?.manualGrade,
    manualNote: m.hasil?.manualNote,
    hasilId: m.hasil?.id,
  }))

  function exportCSV() {
    if (allHasil.length === 0) {
      toast({ title: 'Tidak ada data untuk di-export', variant: 'destructive' })
      return
    }
    const rows = [
      ['NIM', 'Nama', 'Kamar', 'Status', 'Skor', 'Benar', 'Total Soal', 'Manual Grade', 'Catatan', 'Selesai'],
      ...allHasil.map(h => [
        h.mahasiswa?.nim || '',
        h.mahasiswa?.nama || '',
        h.mahasiswa?.kamar?.nama || '',
        h.status,
        h.skorTotal?.toFixed(1) || '0',
        String(h.jumlahBenar || 0),
        String(h.jumlahSoal || 0),
        h.manualGrade !== null && h.manualGrade !== undefined ? String(h.manualGrade) : '',
        h.manualNote || '',
        h.selesai ? new Date(h.selesai).toLocaleString('id-ID') : '-',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hasil-${selectedSesi}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV diunduh' })
  }

  function printReport() {
    window.print()
  }

  // FIX v3.0.8 #1: open Edit Nilai dialog
  function openEditNilai(h: any) {
    setEditingMhs(h)
    setManualGrade(h.manualGrade !== null && h.manualGrade !== undefined
      ? String(h.manualGrade)
      : (h.skorTotal !== null && h.skorTotal !== undefined ? String(h.skorTotal) : ''))
    setManualNote(h.manualNote || '')
    setEditDialogOpen(true)
  }

  // FIX v3.0.8 #1: save manual grade via POST /api/hasil?action=set-manual-grade
  async function saveEditNilai() {
    if (!editingMhs || !selectedSesi) return
    try {
      const r = await fetch('/api/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-manual-grade',
          sesiId: selectedSesi,
          mahasiswaId: editingMhs.mahasiswa.id,
          manualGrade: manualGrade === '' ? null : Number(manualGrade),
          manualNote,
        }),
      }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: '✅ Nilai disimpan' })
      setEditDialogOpen(false)
      setEditingMhs(null)
      loadData() // refresh
    } catch (e: any) {
      toast({ title: 'Gagal simpan', description: e.message, variant: 'destructive' })
    }
  }

  // FIX v3.1.0: lookup mahasiswa by NIM untuk dialog Tambah Hasil Ujian
  async function lookupMhsByNim(nim: string) {
    if (!nim || nim.length < 3) {
      setTambahMhsFound(null)
      return
    }
    try {
      const r = await fetch(`/api/mahasiswa?lookup-by-nim=${encodeURIComponent(nim)}`).then(r => r.json())
      setTambahMhsFound(r.data || null)
    } catch {
      setTambahMhsFound(null)
    }
  }

  // FIX v3.1.0: save Tambah Hasil Ujian manual via POST /api/hasil?action=create-manual-hasil
  async function saveTambahHasil() {
    if (!tambahMhsFound || !selectedSesi) {
      toast({ title: 'Pilih mahasiswa dulu', variant: 'destructive' })
      return
    }
    if (tambahSkor === '' || isNaN(Number(tambahSkor))) {
      toast({ title: 'Nilai wajib diisi (0-100)', variant: 'destructive' })
      return
    }
    setTambahLoading(true)
    try {
      const r = await fetch('/api/hasil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-manual-hasil',
          sesiId: selectedSesi,
          mahasiswaId: tambahMhsFound.id,
          skorTotal: Number(tambahSkor),
          selesai: tambahSelesai ? new Date(tambahSelesai) : new Date(),
          manualNote: tambahCatatan,
          catatan: tambahCatatan,
        }),
      }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: '✅ Hasil ujian ditambahkan' })
      setTambahDialogOpen(false)
      setTambahNim('')
      setTambahMhsFound(null)
      setTambahSkor('')
      setTambahCatatan('')
      loadData() // refresh
    } catch (e: any) {
      toast({ title: 'Gagal simpan', description: e.message, variant: 'destructive' })
    }
    setTambahLoading(false)
  }

  if (loading) return <Loading />

  // FIX v2.9.2: hapus reference ke `h.mahasiswa?.kode` (field sudah di-rename ke `nim`).
  // FIX v3.0.8: filter by status baru (semua, submitted, graded, ongoing, tidak_ikut)
  const filteredHasil = allHasil.filter(h => {
    const matchSearch = !searchMhs ||
      (h.mahasiswa?.nama || '').toLowerCase().includes(searchMhs.toLowerCase()) ||
      (h.mahasiswa?.nim || '').toLowerCase().includes(searchMhs.toLowerCase())
    const matchStatus = filterStatus === 'all' || h.status === filterStatus
    return matchSearch && matchStatus
  })

  // FIX v3.0.8: count per status untuk tab label + filter dropdown
  const countByStatus = {
    all: allHasil.length,
    submitted: allHasil.filter(h => h.status === 'submitted').length,
    graded: allHasil.filter(h => h.status === 'graded').length,
    ongoing: allHasil.filter(h => h.status === 'ongoing').length,
    tidak_ikut: allHasil.filter(h => h.status === 'tidak_ikut').length,
  }

  // FIX v3.0.8: helper untuk status badge variant
  const statusVariant = (status: string) => {
    if (status === 'submitted' || status === 'graded') return 'success'
    if (status === 'ongoing') return 'warning'
    if (status === 'tidak_ikut') return 'default'
    return 'default'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hasil &amp; Evaluasi</h2>
          <p className="text-sm text-gray-500 mt-1">Analisis hasil ujian — semua mahasiswa termasuk yang tidak ikut</p>
        </div>
        <div className="flex gap-3 items-center no-print">
          <Select value={selectedSesi} onValueChange={setSelectedSesi}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Pilih sesi" /></SelectTrigger>
            <SelectContent>
              {sesiList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* FIX v3.1.0: tombol Tambah Data Hasil Ujian — admin input manual hasil tes untuk mhs */}
          <Button
            variant="default"
            onClick={() => {
              setTambahNim('')
              setTambahMhsFound(null)
              setTambahSkor('')
              setTambahSelesai(new Date().toISOString().slice(0, 16))
              setTambahCatatan('')
              setTambahDialogOpen(true)
            }}
            disabled={!selectedSesi}
            className="bg-emerald-600 hover:bg-emerald-700"
            title="Tambah hasil ujian manual (untuk mhs yang tidak ikut tapi dikasih nilai)"
          >
            <Plus className="w-4 h-4 mr-1" /> Tambah Hasil Ujian
          </Button>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
          <Button variant="outline" onClick={printReport}><Printer className="w-4 h-4 mr-1" /> Print</Button>
        </div>
      </div>

      {!selectedSesi ? (
        <EmptyState title="Pilih sesi ujian dulu" />
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="no-print">
            {/* FIX v3.0.8: count = total mhs (termasuk tidak ikut), bukan hanya hasil tes yang ada */}
            <TabsTrigger value="all">Semua Hasil ({countByStatus.all})</TabsTrigger>
            <TabsTrigger value="per-materi">Per Materi</TabsTrigger>
            <TabsTrigger value="cross-tab">Cross-Tab (Kamar × Materi)</TabsTrigger>
          </TabsList>

          {/* Tab: All hasil — FIX v3.0.8: SEMUA mhs (termasuk tidak ikut) */}
          <TabsContent value="all" className="space-y-4">
            {/* FIX v3.0.8 #2: filter dropdown status baru + search bar */}
            <div className="flex items-center gap-3 flex-wrap no-print">
              <Input placeholder="Cari nama/NIM mahasiswa..." value={searchMhs} onChange={(e) => setSearchMhs(e.target.value)} className="max-w-xs" />
              <div className="flex gap-1">
                {/* FIX v3.0.8 #2: button filter status baru — Semua, Submitted, Graded, Ongoing, Tidak Ikut */}
                {[
                  { id: 'all', label: `Semua (${countByStatus.all})` },
                  { id: 'submitted', label: `Submitted (${countByStatus.submitted})` },
                  { id: 'graded', label: `Graded (${countByStatus.graded})` },
                  { id: 'ongoing', label: `Ongoing (${countByStatus.ongoing})` },
                  { id: 'tidak_ikut', label: `Tidak Ikut (${countByStatus.tidak_ikut})` },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setFilterStatus(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                      filterStatus === opt.id
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:text-gray-900 border border-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {filteredHasil.length === 0 ? (
                  <EmptyState title="Belum ada data untuk filter ini" />
                ) : (
                  <div className="overflow-x-auto scroll-thin max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3">NIM</th>
                          <th className="text-left py-2 px-3">Nama</th>
                          <th className="text-left py-2 px-3">Kamar</th>
                          <th className="text-left py-2 px-3">Status</th>
                          <th className="text-left py-2 px-3">Skor</th>
                          <th className="text-left py-2 px-3">Benar/Total</th>
                          <th className="text-left py-2 px-3">Catatan</th>
                          <th className="text-left py-2 px-3">Selesai</th>
                          {/* FIX v3.0.8 #1: kolom Aksi — tombol Edit Nilai per mhs */}
                          <th className="text-left py-2 px-3">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHasil
                          .sort((a, b) => {
                            // FIX v3.0.8: sort by kamar.nama asc (sama dengan v2.9.2) lalu skor desc
                            const kamarCompare = String(a.mahasiswa?.kamar?.nama || '').localeCompare(String(b.mahasiswa?.kamar?.nama || ''))
                            if (kamarCompare !== 0) return kamarCompare
                            return (b.skorTotal || 0) - (a.skorTotal || 0)
                          })
                          .map(h => {
                            const skor = h.skorTotal ?? null
                            const grade = skor !== null ? getGrade(skor) : null
                            return (
                              <tr key={h.id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3"><Badge variant="info">{h.mahasiswa?.nim}</Badge></td>
                                <td className="py-2 px-3 font-medium">{h.mahasiswa?.nama}</td>
                                <td className="py-2 px-3">{h.mahasiswa?.kamar?.nama}</td>
                                <td className="py-2 px-3">
                                  {/* FIX v3.0.8 #2: badge status baru — 'tidak_ikut' tampil dengan label 'Tidak Ikut' (gray) */}
                                  <Badge variant={statusVariant(h.status)}>
                                    {h.status === 'tidak_ikut' ? 'Tidak Ikut' : h.status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3">
                                  {skor !== null ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className={`font-bold ${grade!.color}`}>{skor.toFixed(1)}%</span>
                                      <span className={`font-arabic text-sm ${grade!.color}`}>{grade!.arabic}</span>
                                      {/* FIX v3.0.8 #1: tampilkan badge "Manual" kalau manualGrade di-set (override) */}
                                      {h.manualGrade !== null && h.manualGrade !== undefined && (
                                        <span className="text-[9px] text-amber-600 italic">override</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-3">{h.jumlahBenar}/{h.jumlahSoal}</td>
                                <td className="py-2 px-3 text-xs text-gray-500 max-w-[200px] truncate" title={h.manualNote || ''}>
                                  {h.manualNote || '-'}
                                </td>
                                <td className="py-2 px-3 text-gray-500 text-xs">
                                  {h.selesai ? new Date(h.selesai).toLocaleString('id-ID') : '-'}
                                </td>
                                <td className="py-2 px-3">
                                  {/* FIX v3.0.8 #1: tombol Edit Nilai + keterangan text box per mhs */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditNilai(h)}
                                    className="rounded-lg h-7 text-xs"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" /> Edit Nilai
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Per-materi item analysis — KEMBALI ke layout original (v3.1.1) */}
          <TabsContent value="per-materi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item Analysis — Tingkat Kesulitan Soal</CardTitle>
              </CardHeader>
              <CardContent>
                {byMateri.length === 0 ? (
                  <EmptyState title="Belum ada data" />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={byMateri} layout="vertical" margin={{ left: 200 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="no" tick={{ fontSize: 11 }} tickFormatter={(v) => `#${v}`} />
                        <Tooltip
                          formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Akurasi']}
                          labelFormatter={(label: any, payload: any) => {
                            const item = payload?.[0]?.payload
                            return item ? `Soal #${item.no}: ${item.pertanyaan?.slice(0, 60)}...` : `Soal #${label}`
                          }}
                        />
                        <Bar dataKey="accuracy" fill="#0284c7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-2 px-3">#</th>
                            <th className="text-right py-2 px-3">Pertanyaan Arabic</th>
                            <th className="text-left py-2 px-3">Pertanyaan</th>
                            <th className="text-left py-2 px-3">Benar</th>
                            <th className="text-left py-2 px-3">Total</th>
                            <th className="text-left py-2 px-3">Akurasi</th>
                            <th className="text-left py-2 px-3">Tingkat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byMateri.map((m: any) => (
                            <tr key={m.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3">#{m.no}</td>
                              <td className="py-2 px-3 text-right">
                                {m.arabic && <ArabicText size="md" className="text-emerald-700">{m.arabic}</ArabicText>}
                              </td>
                              <td className="py-2 px-3 text-xs text-gray-600 max-w-xs truncate">{m.pertanyaan}</td>
                              <td className="py-2 px-3 text-emerald-700 font-medium">{m.benar}</td>
                              <td className="py-2 px-3">{m.total}</td>
                              <td className="py-2 px-3 font-bold">{m.accuracy.toFixed(1)}%</td>
                              <td className="py-2 px-3">
                                <Badge variant={m.accuracy >= 80 ? 'success' : m.accuracy >= 60 ? 'warning' : 'danger'}>
                                  {m.accuracy >= 80 ? 'Mudah' : m.accuracy >= 60 ? 'Sedang' : 'Sulit'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Cross-tab heatmap — KEMBALI ke layout original (v3.1.1) */}
          <TabsContent value="cross-tab" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Heatmap Kamar × Soal</CardTitle>
                <p className="text-xs text-gray-500 mt-1">Akurasi (%) per kamar per soal. Sel merah = banyak yang salah, hijau = banyak yang benar.</p>
              </CardHeader>
              <CardContent>
                {!crossTab || !crossTab.matrix || crossTab.matrix.length === 0 ? (
                  <EmptyState title="Belum ada data cross-tab" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 p-2 sticky left-0 bg-white">Kamar</th>
                          {crossTab.soal?.map((s: any) => (
                            <th key={s.id} className="border border-gray-300 p-2 min-w-[120px]">
                              <div className="text-center">
                                <div className="text-xs text-gray-500">#{s.no}</div>
                                {s.arabic && (
                                  <div className="my-1">
                                    <ArabicText size="sm" className="text-emerald-700">{s.arabic}</ArabicText>
                                  </div>
                                )}
                                {s.arti && <div className="text-xs text-gray-400">{s.arti}</div>}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {crossTab.matrix?.map((row: any) => (
                          <tr key={row.kamarId}>
                            <td className="border border-gray-300 p-2 font-medium bg-gray-50 sticky left-0">{row.kamarNama}</td>
                            {crossTab.soal?.map((s: any) => {
                              const cell = row.cells?.[s.id]
                              if (!cell) {
                                return <td key={s.id} className="border border-gray-300 p-2 text-center text-gray-300">-</td>
                              }
                              const acc = cell.accuracy
                              const bgColor = acc >= 80 ? 'bg-emerald-100 text-emerald-800'
                                : acc >= 60 ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                              return (
                                <td key={s.id} className={`border border-gray-300 p-2 text-center ${bgColor}`}>
                                  <div className="font-bold">{acc.toFixed(0)}%</div>
                                  <div className="text-xs">{cell.benar}/{cell.total}</div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ===== FIX v3.0.8 #1: Dialog Edit Nilai + Keterangan ===== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-emerald-600" /> Edit Nilai Mahasiswa
            </DialogTitle>
          </DialogHeader>
          {editingMhs && (
            <div className="space-y-3 py-2">
              <div>
                <p className="text-sm font-medium">{editingMhs.mahasiswa?.nama}</p>
                <p className="text-xs text-gray-500">
                  {editingMhs.mahasiswa?.nim} · {editingMhs.mahasiswa?.kamar?.nama || '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Status: <Badge variant={statusVariant(editingMhs.status)} className="text-[10px]">
                    {editingMhs.status === 'tidak_ikut' ? 'Tidak Ikut' : editingMhs.status}
                  </Badge>
                </p>
                {editingMhs.skorTotal !== null && editingMhs.skorTotal !== undefined && (
                  <p className="text-xs text-gray-400 mt-1">
                    Skor tes: {editingMhs.skorTotal.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase">Nilai Manual (0-100)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={manualGrade}
                  onChange={(e) => setManualGrade(e.target.value)}
                  placeholder="contoh: 75.5 — kosongkan untuk hapus override"
                />
                <p className="text-[10px] text-gray-400">
                  Override skor tes. Kalau mhs tidak ikut, isi nilai tetap (mis. 0 atau nilai dispensasi).
                  Kosongkan untuk kembalikan ke skor tes asli.
                </p>
              </div>
              {/* FIX v3.0.8 #1: keterangan text box — tulis sendiri per mhs */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase">Keterangan (catatan admin)</label>
                <Textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  rows={3}
                  placeholder="Mis: tidak ikut karena sakit, dispensasi, terlambat, dll"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button onClick={saveEditNilai} className="bg-emerald-600 hover:bg-emerald-700">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== FIX v3.1.0: Dialog Tambah Hasil Ujian Manual =====
           User request: "tombol tambahkan data hasil ujian, nanti muncul opsi isi nama/nim
           otomatis kelengkap data2 pentingnya dan isi berapa nilai, waktu selesai, dan catatan" */}
      <Dialog open={tambahDialogOpen} onOpenChange={setTambahDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" /> Tambah Hasil Ujian Manual
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Untuk mahasiswa yang tidak ikut ujian tapi dikasih nilai (dispensasi, sakit, dll).
              Data hasil tes + jawaban detail TIDAK dibuat — hanya nilai akhir + catatan.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* FIX v3.1.0: input NIM + auto-lookup mhs (nama + kamar auto-fill) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase">NIM Mahasiswa</label>
              <Input
                value={tambahNim}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setTambahNim(val)
                  lookupMhsByNim(val)
                }}
                placeholder="contoh: 2657184001"
                className="font-mono"
              />
            </div>
            {/* Auto-fill info mhs ketika NIM ketemu */}
            {tambahMhsFound && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-medium text-emerald-900">{tambahMhsFound.nama}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  NIM: {tambahMhsFound.nim} · Kamar: {tambahMhsFound.kamar?.nama || '-'}
                </p>
                {tambahMhsFound.isKetuaKamar && <span className="text-[10px] text-amber-600">Ketua Kamar</span>}
              </div>
            )}
            {tambahNim.length === 10 && !tambahMhsFound && (
              <p className="text-xs text-rose-600">NIM tidak ditemukan</p>
            )}
            {/* FIX v3.1.0: input nilai */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase">Nilai (0-100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={tambahSkor}
                onChange={(e) => setTambahSkor(e.target.value)}
                placeholder="contoh: 75.5"
              />
            </div>
            {/* FIX v3.1.0: input waktu selesai */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase">Waktu Selesai</label>
              <Input
                type="datetime-local"
                value={tambahSelesai}
                onChange={(e) => setTambahSelesai(e.target.value)}
              />
            </div>
            {/* FIX v3.1.0: catatan text box */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase">Catatan</label>
              <Textarea
                value={tambahCatatan}
                onChange={(e) => setTambahCatatan(e.target.value)}
                rows={3}
                placeholder="Mis: dispensasi sakit, tidak ikut karena alasan..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTambahDialogOpen(false)}>Batal</Button>
            <Button
              onClick={saveTambahHasil}
              disabled={!tambahMhsFound || tambahSkor === '' || tambahLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {tambahLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              Simpan Hasil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
