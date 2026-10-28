'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { ArabicText, EmptyState, Loading, Badge, StatCard } from '@/components/shared'

export function ProgressView({ session }: { session: any }) {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/hasil?action=by-mahasiswa&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json()).then(d => {
      setDetail(d.data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading />

  const avgScore = detail.length > 0 ? detail.reduce((s, h) => s + (h.skorTotal || 0), 0) / detail.length : 0
  const totalBenar = detail.reduce((s, h) => s + (h.jumlahBenar || 0), 0)
  const totalSoal = detail.reduce((s, h) => s + (h.jumlahSoal || 0), 0)
  const sesiDone = detail.filter(h => h.status !== 'ongoing').length

  const chartData = detail.map(h => ({
    nama: h.sesi?.nama?.slice(0, 15) || '',
    skor: h.skorTotal || 0,
    selesai: h.selesai ? new Date(h.selesai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '',
  }))

  // Per-materi analysis dari detail
  const materiStats: Record<string, { arabic: string; arti: string; benar: number; total: number }> = {}
  for (const h of detail) {
    for (const d of h.detail || []) {
      if (!d.soal?.materi) continue
      const mId = d.soal.materi.id
      if (!materiStats[mId]) {
        materiStats[mId] = {
          arabic: d.soal.materi.arabic,
          arti: d.soal.materi.arti,
          benar: 0,
          total: 0,
        }
      }
      materiStats[mId].total += 1
      if (d.benar) materiStats[mId].benar += 1
    }
  }
  const materiArr = Object.values(materiStats).map(m => ({ ...m, accuracy: m.total > 0 ? (m.benar / m.total) * 100 : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy) // yang terlemah di atas

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Progres Saya</h2>
        <p className="text-sm text-gray-500 mt-1">Riwayat ujian &amp; analisis</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Sesi" value={sesiDone} />
        <StatCard label="Rata-rata Skor" value={`${avgScore.toFixed(1)}%`} />
        <StatCard label="Total Benar" value={`${totalBenar}/${totalSoal}`} />
        <StatCard label="Kamar" value={session.mahasiswa?.kamar?.nama || '-'} sub={session.mahasiswa?.isKetuaKamar ? 'Ketua' : 'Anggota'} />
      </div>

      {detail.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Skor Saya</CardTitle>
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

          {materiArr.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Materi yang Perlu Diperbaiki</CardTitle>
                <p className="text-xs text-gray-500 mt-1">Diurut dari yang paling lemah</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {materiArr.slice(0, 10).map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded">
                      <Badge variant={m.accuracy >= 80 ? 'success' : m.accuracy >= 60 ? 'warning' : 'danger'}>
                        {m.accuracy.toFixed(0)}%
                      </Badge>
                      <ArabicText size="md" className="text-gray-900 flex-1 text-right">{m.arabic}</ArabicText>
                      <span className="text-gray-500 text-sm flex-1">{m.arti}</span>
                      <span className="text-xs text-gray-400">{m.benar}/{m.total}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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
                        <td className="py-2 px-3 font-bold">{h.skorTotal?.toFixed(1)}%</td>
                        <td className="py-2 px-3">{h.jumlahBenar}/{h.jumlahSoal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Belum ada riwayat ujian" description="Mulai kerjakan ujian yang tersedia" />
      )}
    </div>
  )
}
