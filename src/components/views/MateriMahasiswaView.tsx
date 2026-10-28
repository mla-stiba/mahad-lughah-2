'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, Loading } from '@/components/shared'
import { ArabicText } from '@/components/shared'
import { Clock, BookOpen, ChevronDown, ChevronUp, Package, PackageOpen } from 'lucide-react'

export function MateriMahasiswaView({ session }: { session: any }) {
  const [loading, setLoading] = useState(true)
  // FIX v3.0.5: state untuk pakets + lepas (bukan flat array lagi)
  const [pakets, setPakets] = useState<any[]>([])
  const [lepas, setLepas] = useState<any[]>([])
  // FIX v3.0.5: state untuk track paket mana yang di-expand (Buka button)
  const [expandedPaketIds, setExpandedPaketIds] = useState<Set<string>>(new Set())
  // FIX #1: rubah filter dari jenis (mufrodat/tarkib) → waktu rilis
  const [filterHari, setFilterHari] = useState<'all' | 'today' | 'yesterday' | '7days'>('all')

  useEffect(() => {
    fetch('/api/materi-mahasiswa').then(r => r.json()).then(d => {
      setPakets(d.data?.pakets || [])
      setLepas(d.data?.lepas || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <Loading />

  const now = new Date()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date()
  startYesterday.setDate(startYesterday.getDate() - 1)
  startYesterday.setHours(0, 0, 0, 0)
  const start7Days = new Date()
  start7Days.setDate(start7Days.getDate() - 7)
  start7Days.setHours(0, 0, 0, 0)

  const filterByDate = (m: any) => {
    const tgl = m.tanggalRilis ? new Date(m.tanggalRilis) : (m.createdAt ? new Date(m.createdAt) : null)
    if (!tgl) return filterHari === 'all'
    if (filterHari === 'today') return tgl >= startOfToday
    if (filterHari === 'yesterday') return tgl >= startYesterday && tgl < startOfToday
    if (filterHari === '7days') return tgl >= start7Days
    return true
  }

  // FIX v3.0.5: filter paket by tanggalRilis paketnya sendiri
  const filteredPakets = pakets.filter(filterByDate)
  const filteredLepas = lepas.filter(filterByDate)

  const togglePaket = (id: string) => {
    setExpandedPaketIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isPaketExpanded = (id: string) => expandedPaketIds.has(id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Materi</h2>
          <p className="text-sm text-gray-500 mt-1">Materi yang sudah dirilis</p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { id: 'today' as const, label: 'Hari Ini' },
            { id: 'yesterday' as const, label: 'Kemarin' },
            { id: '7days' as const, label: '7 Hari' },
            { id: 'all' as const, label: 'Semua' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterHari(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                filterHari === opt.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 border border-gray-200'
              }`}
              style={{ borderRadius: 0 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filteredPakets.length === 0 && filteredLepas.length === 0 ? (
        <EmptyState title="Belum ada materi dirilis" description="Materi yang sudah dijadwalkan akan muncul di sini" />
      ) : (
        <div className="space-y-6">
          {/* ====== FIX v3.0.5: PAKET MATERI (with Buka button to expand items) ====== */}
          {filteredPakets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-gray-700">Paket Materi ({filteredPakets.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPakets.map(p => {
                  const expanded = isPaketExpanded(p.id)
                  const items = p.items || []
                  const isToday = p.tanggalRilis && new Date(p.tanggalRilis).toDateString() === now.toDateString()
                  return (
                    <Card key={p.id} className={isToday ? 'border-emerald-200 bg-emerald-50/10' : ''}>
                      <CardContent className="p-4 space-y-3">
                        {/* Header paket */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="success" className="text-[10px]"><Package className="w-2.5 h-2.5 inline mr-0.5" />Paket</Badge>
                              {p.pekan && <Badge variant="gold" className="text-[10px]">Pekan {p.pekan}</Badge>}
                              {isToday && (
                                <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold ml-auto">Baru Hari Ini</span>
                              )}
                            </div>
                            <p className="font-bold text-gray-900 mt-1">{p.nama}</p>
                            {p.tema && <ArabicText size="md" className="text-emerald-700 mt-1">{p.tema}</ArabicText>}
                            {p.deskripsi && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.deskripsi}</p>}
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                              <span>{items.length} item</span>
                              {p.tanggalRilis && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(p.tanggalRilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* FIX v3.0.5: gambar paket thumbnail square 1:1 */}
                          {p.imageUrl && (
                            <div className="aspect-square w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <img src={p.imageUrl} alt={p.nama} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                        {/* FIX v3.0.5: tombol "Buka" untuk expand items di dalam paket */}
                        <button
                          onClick={() => togglePaket(p.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                        >
                          {expanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" /> Tutup
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" /> Buka ({items.length} item)
                            </>
                          )}
                        </button>
                        {/* FIX v3.0.5: items muncul setelah tombol Buka diklik */}
                        {expanded && (
                          <div className="space-y-2 pt-2 border-t border-gray-100">
                            {items.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-2">Belum ada item di paket ini</p>
                            ) : (
                              items.map((m: any) => (
                                <div key={m.id} className="p-2 bg-gray-50 rounded-lg space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={m.jenis === 'mufrodat' ? 'info' : 'warning'} className="text-[10px]">{m.jenis}</Badge>
                                    {m.kategori && <span className="text-[10px] text-gray-400">{m.kategori}</span>}
                                  </div>
                                  <div className="text-right">
                                    <ArabicText size="md" className="text-gray-900">{m.arabic}</ArabicText>
                                  </div>
                                  <p className="text-sm font-medium">{m.arti}</p>
                                  {m.contoh && (
                                    <div className="text-right text-xs text-gray-500 bg-white rounded p-1.5">
                                      <ArabicText size="sm" className="text-gray-600">{m.contoh}</ArabicText>
                                    </div>
                                  )}
                                  {/* FIX v3.0.5: gambar item square 1:1 */}
                                  {m.imageUrl && (
                                    <div className="aspect-square w-full max-w-[120px] rounded-lg overflow-hidden bg-gray-100 mx-auto">
                                      <img src={m.imageUrl} alt={m.arti} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  {m.audioUrl && <audio controls src={m.audioUrl} className="w-full h-8" preload="none" />}
                                  {m.videoUrl && (
                                    m.videoUrl.includes('youtube.com') || m.videoUrl.includes('youtu.be') ? (
                                      <iframe src={m.videoUrl} className="w-full aspect-square rounded-lg" allowFullScreen />
                                    ) : (
                                      <video controls src={m.videoUrl} className="w-full max-h-32 rounded-lg" preload="metadata" />
                                    )
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ====== MATERI LEPAS (di luar paket) ====== */}
          {filteredLepas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PackageOpen className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-700">Materi Lepas ({filteredLepas.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLepas.map((m: any) => {
                  const isToday = m.tanggalRilis && new Date(m.tanggalRilis).toDateString() === now.toDateString()
                  return (
                    <Card key={m.id} className={isToday ? 'border-emerald-200 bg-emerald-50/10' : ''}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={m.jenis === 'mufrodat' ? 'info' : 'warning'}>{m.jenis}</Badge>
                          {m.kategori && <span className="text-xs text-gray-400">{m.kategori}</span>}
                          {isToday && (
                            <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold ml-auto">Baru Hari Ini</span>
                          )}
                        </div>
                        <div className="text-right">
                          <ArabicText size="lg" className="text-gray-900">{m.arabic}</ArabicText>
                        </div>
                        <p className="text-sm font-medium">{m.arti}</p>
                        {m.contoh && (
                          <div className="text-right text-sm text-gray-500 bg-gray-50 rounded p-2">
                            <ArabicText size="sm" className="text-gray-600">{m.contoh}</ArabicText>
                          </div>
                        )}
                        {/* FIX v3.0.5: gambar square 1:1 */}
                        {m.imageUrl && (
                          <div className="aspect-square w-full max-w-[200px] rounded-lg overflow-hidden bg-gray-100 mx-auto">
                            <img src={m.imageUrl} alt={m.arti} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {m.audioUrl && <audio controls src={m.audioUrl} className="w-full h-8" preload="none" />}
                        {m.tanggalRilis && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(m.tanggalRilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
