'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { toast } from '@/hooks/use-toast'
import { ArabicText, EmptyState, Loading, Badge, StatCard, PageHeader } from '@/components/shared'
import { getGrade, GradeBadge } from '@/components/shared/grade'
import { Edit2 } from 'lucide-react'

export function PerMahasiswaView() {
  const [loading, setLoading] = useState(true)
  const [mhsList, setMhsList] = useState<any[]>([])
  const [selectedMhs, setSelectedMhs] = useState('')
  const [detail, setDetail] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    // FIX v2.9.1: pass take=2000 untuk ambil SEMUA mahasiswa (default API 100 limit terlalu kecil untuk 225 mhs)
    fetch('/api/mahasiswa?take=2000').then(r => r.json()).then(d => {
      setMhsList(d.data || [])
      if (d.data && d.data.length > 0) {
        setSelectedMhs(d.data[0].id)
      }
      setLoading(false)
    })
  }, [])

  async function loadDetail(mhsId: string) {
    if (!mhsId) return
    setLoading(true)
    const r = await fetch(`/api/hasil?action=by-mahasiswa&mahasiswaId=${mhsId}`).then(r => r.json())
    setDetail(r.data || [])
    setLoading(false)
  }

  useEffect(() => { if (selectedMhs) loadDetail(selectedMhs) }, [selectedMhs])

  if (loading) return <Loading />

  // FIX v2.9.2: hapus reference ke `m.kode` (field sudah di-rename ke `nim` di iterasi 5).
  // Sebelumnya: ketika user ketik di search bar, `m.kode` undefined → `.toLowerCase()` throw TypeError → app crash.
  // Sekarang: pakai `nim` + null-safe (|| '').
  const filteredMhs = mhsList.filter(m =>
    !search ||
    (m.nama || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.nim || '').toLowerCase().includes(search.toLowerCase())
  )

  const mhs = mhsList.find(m => m.id === selectedMhs)
  const avgScore = detail.length > 0 ? detail.reduce((s, h) => s + (h.skorTotal || 0), 0) / detail.length : 0
  const totalBenar = detail.reduce((s, h) => s + (h.jumlahBenar || 0), 0)
  const totalSoal = detail.reduce((s, h) => s + (h.jumlahSoal || 0), 0)

  // Chart data: skor per sesi
  const chartData = detail.map(h => ({
    nama: h.sesi?.nama || '',
    skor: h.skorTotal || 0,
    benar: h.jumlahBenar || 0,
    total: h.jumlahSoal || 0,
    selesai: h.selesai ? new Date(h.selesai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '',
  }))

  function exportPDF() {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Evaluasi Per Mahasiswa</h2>
          <p className="text-sm text-gray-500 mt-1">Riwayat &amp; progres hafalan individu</p>
        </div>
        <Button variant="outline" onClick={exportPDF} className="no-print">Export Laporan PDF</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: list mahasiswa */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Pilih Mahasiswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Cari nama/NIM..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-96 overflow-y-auto scroll-thin space-y-1">
              {filteredMhs.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMhs(m.id)}
                  className={`w-full text-left p-2 rounded border ${m.id === selectedMhs ? 'bg-emerald-50 border-emerald-300' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{m.nim}</Badge>
                    <span className="font-medium text-sm">{m.nama}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{m.kamar?.nama}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: detail */}
        <div className="lg:col-span-2 space-y-4">
          {mhs && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{mhs.nama}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      <Badge variant="info">{mhs.nim}</Badge> &middot; {mhs.kamar?.nama}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${getGrade(avgScore).color}`}>{avgScore.toFixed(1)}%</p>
                    <div className="mt-1"><GradeBadge skor={avgScore} /></div>
                    <p className="text-xs text-gray-500">Rata-rata</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-lg font-bold">{detail.length}</p>
                    <p className="text-xs text-gray-500">Total Sesi</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-lg font-bold">{totalBenar}</p>
                    <p className="text-xs text-gray-500">Total Benar</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <p className="text-lg font-bold">{totalSoal}</p>
                    <p className="text-xs text-gray-500">Total Soal</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {detail.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tren Skor per Sesi</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="selesai" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Skor']} />
                    <Line type="monotone" dataKey="skor" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {detail.length === 0 ? (
                <EmptyState title="Belum ada riwayat ujian" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3">Sesi</th>
                        <th className="text-left py-2 px-3">Selesai</th>
                        <th className="text-left py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Skor</th>
                        <th className="text-left py-2 px-3">Benar/Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.map(h => (
                        <tr key={h.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{h.sesi?.nama}</td>
                          <td className="py-2 px-3 text-xs text-gray-500">{h.selesai ? new Date(h.selesai).toLocaleString('id-ID') : '-'}</td>
                          <td className="py-2 px-3"><Badge variant={h.status === 'graded' ? 'success' : 'warning'}>{h.status}</Badge></td>
                          <td className="py-2 px-3">
                            {(() => {
                              const skor = h.skorTotal || 0
                              const grade = getGrade(skor)
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span className={`font-bold ${grade.color}`}>{skor.toFixed(1)}%</span>
                                  <span className={`font-arabic text-sm ${grade.color}`}>{grade.arabic}</span>
                                </div>
                              )
                            })()}
                          </td>
                          <td className="py-2 px-3">{h.jumlahBenar}/{h.jumlahSoal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FIX v3.0.8: BeriNilaiSesi DIPINDAHKAN ke HasilView (tab "Hasil & Analisis").
           User bilang fitur Edit Nilai + tag "tidak ikut" harus di laman Hasil & Analisis,
           bukan di Evaluasi. Lihat HasilView.tsx untuk implementasinya. */}

    </div>
  )
}
