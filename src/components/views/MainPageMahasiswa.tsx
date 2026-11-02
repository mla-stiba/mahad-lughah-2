'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Loading, PageHeader } from '@/components/shared'
import { ArabicText } from '@/components/shared'
import { FileText, Clock, ArrowRight, BookOpen, Sparkles, AlertCircle, CheckCircle2, Lock } from 'lucide-react'
import Link from 'next/link'

export function MainPageMahasiswa({ session }: { session: any }) {
  const [loading, setLoading] = useState(true)
  const [latestMateri, setLatestMateri] = useState<any[]>([])
  const [latestHasil, setLatestHasil] = useState<any[]>([])
  // FIX #5: tambah state untuk ujian ongoing + ringkasan kamar (kalau ketua)
  const [availableUjian, setAvailableUjian] = useState<any[]>([])
  const [kamarStatus, setKamarStatus] = useState<any>(null)

  useEffect(() => {
    // FIX #5: pakai allSettled supaya kalau salah satu fetch error, lain tetap jalan
    const fetches = [
      fetch('/api/materi-mahasiswa').then(r => r.json()),
      fetch(`/api/hasil?action=by-mahasiswa&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json()),
      fetch(`/api/ujian?action=available&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json()),
    ]
    // Kalau ketua kamar, tambah fetch kamar status
    if (session.mahasiswa?.isKetuaKamar && session.mahasiswa?.kamar?.id) {
      fetches.push(
        fetch(`/api/tracking?action=kamar-status&kamarId=${session.mahasiswa.kamar.id}`).then(r => r.json())
      )
    }

    Promise.allSettled(fetches).then(async (results) => {
      const [matR, hasilR, ujianR, kamarR] = results.map(r => r.status === 'fulfilled' ? r.value : null)
      // FIX v3.0.5: API materi-mahasiswa sekarang return { pakets, lepas } (bukan flat array).
      // Ambil 5 materi terbaru dari kombinasi: items di paket + lepas, sort by tanggalRilis/createdAt.
      const pakets = matR?.data?.pakets || []
      const lepas = matR?.data?.lepas || []
      // Items di paket (sudah include tanggalRilis & createdAt)
      const paketItems = pakets.flatMap((p: any) =>
        (p.items || []).map((m: any) => ({ ...m, paketNama: p.nama, paketTema: p.tema }))
      )
      // Combine + sort by tanggalRilis desc (null = pakai createdAt)
      const allMateri = [...paketItems, ...lepas].sort((a: any, b: any) => {
        const da = a.tanggalRilis ? new Date(a.tanggalRilis).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
        const db = b.tanggalRilis ? new Date(b.tanggalRilis).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
        return db - da
      })
      const materi = allMateri.slice(0, 5)
      setLatestMateri(materi)
      setLatestHasil((hasilR?.data || []).slice(0, 5))
      setAvailableUjian(ujianR?.data || [])
      setKamarStatus(kamarR?.data || null)
      setLoading(false)
      // Record view event untuk semua materi yang ditampilkan di beranda
      if (materi.length > 0) {
        Promise.all(materi.map(m =>
          fetch('/api/tracking?action=view-materi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mahasiswaId: session.mahasiswa.id, materiId: m.id }),
          }).catch(() => {})
        ))
      }
    })
  }, [])

  if (loading) return <Loading />

  // Filter ujian yang ongoing (belum dikerjakan ATAU masih ongoing)
  const ujianOngoing = availableUjian.filter(s => {
    if (s.deadlinePassed) return false  // sudah lewat deadline, bukan ongoing
    if (!s.hasil || s.hasil.length === 0) return true  // belum dikerjakan
    return s.hasil[0].status === 'ongoing'  // masih ongoing
  })

  // Filter ujian yang sudah lewat deadline tapi belum dikerjakan (perlu ditampilkan sbg peringatan)
  const ujianTerlewat = availableUjian.filter(s => {
    if (!s.deadlinePassed) return false
    return !s.hasil || s.hasil.length === 0
  })

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-gradient-to-br from-[oklch(0.35_0.14_265)] to-[oklch(0.25_0.06_265)] text-white rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl" />
        <h1 className="text-2xl font-bold font-display">Assalamualaikum, {session.mahasiswa?.nama}!</h1>
        <p className="text-white/80 text-sm mt-1">Selamat datang di Ma'had Lughah</p>
        <div className="flex gap-3 mt-4">
          <Badge variant="info">{session.mahasiswa?.nim}</Badge>
          <span className="text-white/70 text-sm">{session.mahasiswa?.kamar?.nama}</span>
          {session.mahasiswa?.isKetuaKamar && <Badge variant="gold" className="text-white">Ketua Kamar</Badge>}
        </div>
      </div>

      {/* FIX #5: Panel Ujian Ongoing — ujian yang aktif + belum dikerjakan */}
      {(ujianOngoing.length > 0 || ujianTerlewat.length > 0) && (
        <Card className="rounded-2xl border border-amber-300 bg-amber-50/30 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Tes Aktif & Peringatan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ujianOngoing.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.nama}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {s.level?.nama} · {s._count?.soal ?? 0} soal
                    {s.jamSelesai && <span className="ml-2 text-rose-600 font-semibold">⏰ Tutup: {s.jamSelesai}</span>}
                  </p>
                </div>
                <Badge variant="success" className="ml-2">Belum dikerjakan</Badge>
              </div>
            ))}
            {ujianTerlewat.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-200">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.nama}</p>
                  <p className="text-xs text-rose-700 mt-0.5">
                    <Lock className="w-3 h-3 inline mr-1" />
                    Deadline sudah lewat, ujian terkunci. Anda tidak mengerjakan.
                  </p>
                </div>
                <Badge variant="danger" className="ml-2">Tidak dikerjakan</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* FIX #5: Panel Evaluasi Anggota Kamar — khusus untuk ketua kamar */}
      {session.mahasiswa?.isKetuaKamar && kamarStatus && (
        <Card className="rounded-2xl border border-violet-300 bg-violet-50/30 shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-violet-600" />
              Status Anggota Kamar {kamarStatus.kamar?.nama}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {kamarStatus.anggota?.filter((a: any) => a.loginToday).length || 0}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Sudah Login Hari Ini</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-rose-700">
                  {kamarStatus.anggota?.filter((a: any) => !a.loginToday).length || 0}
                </p>
                <p className="text-[10px] text-rose-600 mt-0.5">Belum Login Hari Ini</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Total {kamarStatus.anggota?.length || 0} anggota. Buka tab "Kamar Saya" untuk detail + ingatkan via WhatsApp.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Ujian */}
        <Card className="rounded-2xl border border-gray-200 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Tes Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestHasil.length === 0 ? (
              <EmptyState title="Belum ada ujian dikerjakan" />
            ) : (
              latestHasil.map(h => {
                const skor = h.skorTotal || 0
                const grade = getGradeColor(skor)
                return (
                  <div key={h.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{h.sesi?.nama}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {h.selesai ? new Date(h.selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`text-lg font-bold ${grade}`}>{skor.toFixed(0)}%</p>
                      <p className="text-xs text-gray-400">{h.jumlahBenar}/{h.jumlahSoal}</p>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Latest Materi — di-urutkan dari API tanggalRilis DESC, paling baru di atas */}
        <Card className="rounded-2xl border border-gray-200 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" /> Materi Terbaru
              <Badge variant="success" className="text-[10px]"><Sparkles className="w-2.5 h-2.5 mr-0.5" /> Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestMateri.length === 0 ? (
              <EmptyState title="Belum ada materi dirilis" description="Materi yang sudah dijadwalkan akan muncul di sini" />
            ) : (
              latestMateri.map(m => {
                const isToday = m.tanggalRilis && isTodayDate(new Date(m.tanggalRilis))
                const isYesterday = m.tanggalRilis && isYesterdayDate(new Date(m.tanggalRilis))
                return (
                  <div key={m.id} className={`p-3 border rounded-xl hover:bg-gray-50 ${isToday ? 'border-emerald-300 bg-emerald-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={m.jenis === 'mufrodat' ? 'info' : 'warning'}>{m.jenis}</Badge>
                          {m.kategori && <span className="text-xs text-gray-400">{m.kategori}</span>}
                          {isToday && (
                            <Badge variant="success" className="text-[10px] ml-auto">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                              BARU HARI INI
                            </Badge>
                          )}
                          {isYesterday && (
                            <span className="text-[10px] text-gray-500 ml-auto">Kemarin</span>
                          )}
                        </div>
                        <div className="text-right mb-1">
                          <ArabicText size="md" className="text-gray-900">{m.arabic}</ArabicText>
                        </div>
                        <p className="text-sm font-medium">{m.arti}</p>
                      </div>
                      {m.tanggalRilis && (
                        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {isToday ? 'Hari ini' : isYesterday ? 'Kemarin' : new Date(m.tanggalRilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {/* Media preview */}
                    {/* FIX v3.0.5: gambar square 1:1 (sebelumnya max-h-32 object-cover) */}
                    {m.imageUrl && (
                      <div className="aspect-square w-full max-w-[120px] rounded-lg overflow-hidden bg-gray-100 mx-auto mt-2">
                        <img src={m.imageUrl} alt={m.arti} className="w-full h-full object-cover" />
                      </div>
                    )}
                    {m.audioUrl && (
                      <audio controls src={m.audioUrl} className="w-full h-8 mt-2" preload="none" />
                    )}
                    {m.contoh && (
                      <div className="text-right mt-2 bg-gray-50 rounded p-2">
                        <ArabicText size="sm" className="text-gray-600">{m.contoh}</ArabicText>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getGradeColor(skor: number): string {
  if (skor >= 90) return 'text-emerald-600'
  if (skor >= 80) return 'text-blue-600'
  if (skor >= 65) return 'text-amber-600'
  if (skor >= 50) return 'text-orange-600'
  return 'text-rose-600'
}

// Helper: cek apakah tanggal = hari ini
function isTodayDate(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

// Helper: cek apakah tanggal = kemarin
function isYesterdayDate(date: Date): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
}
