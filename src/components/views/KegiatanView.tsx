'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge, EmptyState, Loading, PageHeader } from '@/components/shared'
import { ArabicText } from '@/components/shared'
import { toast } from '@/hooks/use-toast'
import { BookOpen, Calendar, Copy, ChevronRight, ClipboardList } from 'lucide-react'

// ============ KEGIATAN VIEW (Panel Admin v2.8.0) ============
// Fitur:
// - Pilih tanggal (date picker) untuk filter kegiatan per tanggal
// - Dropdown pilih lantai (02, 03, 04, semua) — 08.XX.YY, XX = lantai
// - Card per kamar: kegiatan + hafalan summary
// - Tombol Detail: lihat anggota + perkembangan mufrodat hari itu
// - Tombol Salin Evaluasi Kamar (format WhatsApp)
// - Hapus gender (putra/putri) — semua putra

export function KegiatanView() {
  const [loading, setLoading] = useState(true)
  const [kamarList, setKamarList] = useState<any[]>([])
  const [kegiatanMap, setKegiatanMap] = useState<Record<string, any>>({})
  const [hafalanMap, setHafalanMap] = useState<Record<string, any>>({})
  const [anggotaMap, setAnggotaMap] = useState<Record<string, any[]>>({})
  
  // Filter
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [filterLantai, setFilterLantai] = useState<string>('all')
  
  // Detail dialog
  const [detailKamar, setDetailKamar] = useState<any | null>(null)
  const [detailAnggota, setDetailAnggota] = useState<any[]>([])
  const [detailHafalan, setDetailHafalan] = useState<any[]>([])
  const [detailKegiatan, setDetailKegiatan] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [selectedDate, filterLantai])

  async function loadData() {
    setLoading(true)
    try {
      // FIX perf: 1 fetch pengganti 50 fetch (sebelumnya: 2 fetch per-kamar × 25 kamar)
      // Bundled endpoint: /api/kegiatan?action=summary&date=YYYY-MM-DD&lantai=XX
      const r = await fetch(
        `/api/kegiatan?action=summary&date=${selectedDate}&lantai=${filterLantai}`,
      ).then(r => r.json()).catch(() => ({ data: null }))
      const bundle = r.data
      if (bundle) {
        setKamarList(bundle.kamars || [])
        setKegiatanMap(bundle.kegiatanMap || {})
        setHafalanMap(bundle.hafalanMap || {})
        setAnggotaMap(bundle.anggotaMap || {})
      } else {
        setKamarList([])
        setKegiatanMap({})
        setHafalanMap({})
        setAnggotaMap({})
      }
    } catch {}
    setLoading(false)
  }

  async function openDetail(kamar: any) {
    setDetailKamar(kamar)
    setDetailAnggota(anggotaMap[kamar.id] || [])
    setDetailHafalan(hafalanMap[kamar.id]?.rows || [])
    setDetailKegiatan(kegiatanMap[kamar.id] || null)
  }

  function salinEvaluasiKamar(kamar: any) {
    const keg = kegiatanMap[kamar.id]
    const haf = hafalanMap[kamar.id]
    const anggota = anggotaMap[kamar.id] || []
    
    const lines = [
      '📋 *Monitoring Kamar*',
      '',
      `Kamar: ${kamar.nama}`,
      `Tanggal: ${new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
    ]
    
    if (keg?.kegiatan) {
      lines.push(`🎯 Kegiatan: ${keg.kegiatan}`)
    }
    
    lines.push('', '— Daftar Anggota —')
    
    anggota.forEach((row: any, i: number) => {
      const m = row.mahasiswa
      const totalMateri = row.materi?.length || 0
      // FIX v2.9.2: "hafal" INCLUDES "jumlah" — jumlah adalah subset dari hafal.
      // Sehingga pahamCount = hafal + jumlah (sama seperti versi lama), TAPI label
      // sekarang "X hafal" (bukan "X hafal + Y jumlah" yang misleading).
      // FIX v2.9.8: format per-anggota juga persen saja (konsisten dengan salinEvaluasiKeseluruhan).
      const pahamCount = row.materi?.filter((c: any) => c.status === 'hafal' || c.status === 'jumlah').length || 0
      const persenAnggota = totalMateri > 0 ? ((pahamCount / totalMateri) * 100).toFixed(1) : '0.0'
      lines.push(`${i + 1}. ${m.nama} (${m.nim})`)
      lines.push(`   Hafalan: ${persenAnggota}%`)
    })
    
    lines.push('', '— Tim Pengembangan Bahasa Ma\'had Lughah')
    const message = lines.join('\n')
    
    navigator.clipboard?.writeText(message).then(() => {
      // Silent copy
    }).catch(() => {})
  }

  // ===== SALIN EVALUASI KESELURUHAN (semua kamar sekaligus) =====
  function salinEvaluasiKeseluruhan() {
    if (kamarList.length === 0) return

    const tanggalStr = new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const lantaiLabel = filterLantai === 'all' ? 'Semua Lantai' : `Lantai ${filterLantai}`

    const lines: string[] = [
      '📋 *EVALUASI KESELURUHAN KAMAR*',
      '',
      `Tanggal: ${tanggalStr}`,
      `Filter: ${lantaiLabel}`,
      `Total Kamar: ${kamarList.length}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '',
    ]

    // Hitung aggregate
    let totalAnggota = 0
    let totalHafal = 0
    let totalJumlah = 0
    let totalMateriCell = 0
    let kamarDenganKegiatan = 0
    let kamarBelumIsi = 0

    kamarList.forEach((k: any) => {
      const keg = kegiatanMap[k.id]
      const haf = hafalanMap[k.id]
      const anggota = anggotaMap[k.id] || []

      lines.push(`▶ *Kamar ${k.nama}*`)
      if (keg?.kegiatan) {
        kamarDenganKegiatan++
        lines.push(`  🎯 Kegiatan: ${keg.kegiatan}`)
      } else {
        kamarBelumIsi++
        lines.push(`  ⚠️ Belum ada kegiatan`)
      }

      if (haf) {
        totalAnggota += haf.anggota || 0
        totalHafal += haf.hafal || 0          // sudah INCLUDES jumlah (dari API v2.9.2)
        totalJumlah += haf.jumlah || 0        // SUBSET dari totalHafal
        totalMateriCell += haf.total || 0
        // FIX v2.9.8: format hafalan PERSENTASE SAJA (no X/Y, no "(Z di antaranya jumlah)").
        // Sesuai request user: "hafalan mufrodat persenkan saja jgn x/x gk usah juga ada tulisan berapa jumla"
        const persenKamar = (haf.total || 0) > 0
          ? ((haf.hafal / haf.total) * 100).toFixed(1)
          : '0.0'
        lines.push(`  📊 Hafalan: ${persenKamar}%`)
      } else {
        lines.push(`  📊 Belum ada data hafalan`)
      }
      lines.push('')
    })

    // FIX v2.9.8: Ringkasan simpel sesuai format request user:
    //   📈 *RINGKASAN*
    //   - Total kamar dilaporkan: N
    //   - Kamar dengan kegiatan: N
    //   - Kamar belum isi kegiatan: N
    //   - Persentase hafal: X.X%
    // Hapus line "Total anggota" + "Total hafal (paham)" yang sebelumnya ada.
    lines.push('━━━━━━━━━━━━━━━━━━━━')
    lines.push('')
    lines.push('📈 *RINGKASAN*')
    lines.push(`- Total kamar dilaporkan: ${kamarList.length}`)
    lines.push(`- Kamar dengan kegiatan: ${kamarDenganKegiatan}`)
    lines.push(`- Kamar belum isi kegiatan: ${kamarBelumIsi}`)
    if (totalMateriCell > 0) {
      const persenHafal = ((totalHafal / totalMateriCell) * 100).toFixed(1)
      lines.push(`- Persentase hafal: ${persenHafal}%`)
    } else {
      lines.push(`- Persentase hafal: 0.0%`)
    }
    lines.push('')
    lines.push('— Tim Pengembangan Bahasa Ma\'had Lughah')

    const message = lines.join('\n')

    navigator.clipboard?.writeText(message).then(() => {
      toast({ title: `✅ Evaluasi ${kamarList.length} kamar disalin`, description: 'Tempel ke grup WhatsApp untuk dibagikan' })
    }).catch(() => {
      // Fallback: download sebagai txt
      const blob = new Blob([message], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evaluasi-keseluruhan-${selectedDate}.txt`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Evaluasi diunduh sebagai file' })
    })
  }

  // Extract unique lantai from kamar names
  const lantaiOptions = ['all', '02', '03', '04']

  if (loading) return <Loading />

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Kegiatan" description="Rekap kegiatan kamar & hafalan mufrodat" />

      {/* Filter bar: date picker + lantai dropdown + salin keseluruhan */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-sm"
            style={{ borderRadius: 0 }}
          />
        </div>
        <div className="flex items-center gap-1">
          {lantaiOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setFilterLantai(opt)}
              className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                filterLantai === opt
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-900 border border-gray-200'
              }`}
              style={{ borderRadius: 0 }}
            >
              {opt === 'all' ? 'Semua' : `Lt ${opt}`}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button
            onClick={salinEvaluasiKeseluruhan}
            disabled={kamarList.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-9 px-4 text-xs font-semibold shadow-sm"
            title="Salin laporan evaluasi semua kamar untuk dibagikan ke WhatsApp"
          >
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
            Salin Evaluasi Keseluruhan
          </Button>
        </div>
      </div>

      {kamarList.length === 0 ? (
        <EmptyState title="Belum ada kamar" description="Tambah kamar di menu Data Mahasiswa" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kamarList.map((k: any) => {
            const keg = kegiatanMap[k.id]
            const haf = hafalanMap[k.id]
            return (
              <Card key={k.id} className="border border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>{k.nama}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => salinEvaluasiKamar(k)}
                        className="text-gray-400 hover:text-emerald-600 p-1"
                        title="Salin Evaluasi"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDetail(k)}
                        className="text-gray-400 hover:text-gray-900 p-1"
                        title="Detail"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Kegiatan */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Kegiatan
                    </p>
                    {keg?.kegiatan ? (
                      <p className="text-sm text-gray-800">{keg.kegiatan}</p>
                    ) : (
                      <p className="text-xs text-gray-400">Belum ada kegiatan</p>
                    )}
                  </div>

                  {/* Hafalan summary */}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Hafalan
                    </p>
                    {haf ? (
                      // FIX v2.9.7: card tampilkan PROGRESS HAFALAN DALAM PERSENTASE (utama),
                      // dengan angka raw sebagai info sekunder. Detail dialog tetap pakai angka.
                      // Sebelumnya: "8 hafal / 540 (7 di antaranya jumlah)" — angka terlalu besar
                      // (540) jadi susah dibaca. Persentase lebih intuitif untuk monitoring cepat.
                      (() => {
                        const persen = (haf.total || 0) > 0
                          ? ((haf.hafal / haf.total) * 100).toFixed(1)
                          : '0.0'
                        return (
                          <div className="space-y-0.5">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-emerald-600 font-bold text-xl leading-none">{persen}%</span>
                              <span className="text-gray-500 text-xs">hafal</span>
                            </div>
                            <p className="text-[10px] text-gray-500">
                              {haf.hafal || 0} dari {haf.total || 0} mufrodat
                              {haf.jumlah > 0 && <span className="text-blue-500"> ({haf.jumlah} di antaranya jumlah)</span>}
                            </p>
                          </div>
                        )
                      })()
                    ) : (
                      <p className="text-xs text-gray-400">Belum ada data</p>
                    )}
                    {haf?.anggota !== undefined && (
                      <p className="text-[10px] text-gray-400 mt-1">{haf.anggota} anggota</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {detailKamar && (
        <Dialog open={!!detailKamar} onOpenChange={(o) => !o && setDetailKamar(null)}>
          <DialogContent className="max-w-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
            <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
              <DialogTitle>Kamar {detailKamar.nama}</DialogTitle>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Kegiatan */}
              {detailKegiatan?.kegiatan && (
                <div className="p-3 bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">🎯 Kegiatan</p>
                  <p className="text-sm text-emerald-800">{detailKegiatan.kegiatan}</p>
                  {detailKegiatan.inputBy && <p className="text-[10px] text-emerald-600 mt-1">oleh {detailKegiatan.inputBy}</p>}
                </div>
              )}

              {/* Anggota + Hafalan */}
              <div>
                <p className="text-sm font-semibold mb-2">Anggota & Hafalan</p>
                {detailAnggota.length === 0 ? (
                  <p className="text-xs text-gray-400">Belum ada anggota</p>
                ) : (
                  <div className="space-y-2">
                    {detailAnggota.map((row: any, i: number) => {
                      const m = row.mahasiswa
                      const totalMateri = row.materi?.length || 0
                      // FIX v2.9.2: pahamCount INCLUDES jumlah (jumlah = subset hafal).
                      const pahamCount = row.materi?.filter((c: any) => c.status === 'hafal' || c.status === 'jumlah').length || 0
                      const jumlahSubset = row.materi?.filter((c: any) => c.status === 'jumlah').length || 0
                      return (
                        <div key={m.id} className="flex items-center justify-between p-2 border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {m.nama}
                              {m.isKetuaKamar && <span className="text-[10px] text-amber-600 ml-1">Ketua</span>}
                            </p>
                            <p className="text-[10px] text-gray-500">{m.nim}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-700">
                              {pahamCount}<span className="text-gray-400 font-normal">/{totalMateri}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {jumlahSubset > 0
                                ? `${jumlahSubset} di antaranya jumlah`
                                : 'sudah hafal'
                              }
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white">
              <Button variant="outline" onClick={() => setDetailKamar(null)}>Tutup</Button>
              <Button onClick={() => salinEvaluasiKamar(detailKamar)} className="bg-emerald-600 hover:bg-emerald-700">
                <Copy className="w-3.5 h-3.5 mr-1" /> Salin Evaluasi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
