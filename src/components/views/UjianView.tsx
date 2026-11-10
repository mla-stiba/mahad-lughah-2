'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { useAntiCheat } from '@/hooks/use-anti-cheat'
import { useTTS } from '@/hooks/use-tts'
import { openWhatsAppShare, formatHasilUjianMessage } from '@/lib/wa-share'
import { ArabicText, EmptyState, Loading, Badge } from '@/components/shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGrade, MumtazCelebration } from '@/components/shared/grade'
import { Share2, Volume2, VolumeX, Loader2, Play, Copy, CheckCircle2 } from 'lucide-react'

interface MahasiswaSession {
  role: 'mahasiswa'
  mahasiswa: any
}

export function UjianView({ session }: { session: MahasiswaSession }) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<any[]>([])
  // FIX #9: filter per hari (hari ini, kemarin, 7 hari, semua)
  const [filterHari, setFilterHari] = useState<'today' | 'yesterday' | '7days' | 'all'>('all')
  const [activeSesi, setActiveSesi] = useState<any | null>(null)
  const [hasil, setHasil] = useState<any | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [matchingAnswer, setMatchingAnswer] = useState<Record<string, string>>({}) // {leftArabic: rightArti}
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [view, setView] = useState<'ujian' | 'evaluasi'>('ujian')

  // Anti-cheat aktif hanya saat user sedang mengerjakan ujian (bukan saat done/evaluasi)
  // FIX #5 user: anti-cheat SILENT — gak ada toast warning, gak ada overlay merah
  // Cuma block (Ctrl+C/dll) + overlay hitam saat detect screenshot attempt
  const antiCheatEnabled = !!activeSesi && !done && view === 'ujian'
  const { showOverlay } = useAntiCheat(antiCheatEnabled)

  function shareWhatsApp() {
    if (!hasil || !activeSesi) return
    const skor = hasil.skorTotal || 0
    const grade = getGrade(skor)
    const message = formatHasilUjianMessage({
      mahasiswaNama: session.mahasiswa.nama,
      mahasiswaNim: session.mahasiswa.nim,
      sesiNama: activeSesi.nama,
      skor,
      jumlahBenar: hasil.jumlahBenar || 0,
      jumlahSoal: hasil.jumlahSoal || 0,
      gradeArabic: grade.arabic,
      gradeLetter: grade.letter,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    })
    // Share tanpa nomor - user pilih kontak sendiri di WA
    openWhatsAppShare(null, message)
    toast({ title: 'Dibuka di WhatsApp', description: 'Pilih kontak/grup untuk share hasil' })
  }

  async function loadAvailable() {
    setLoading(true)
    const r = await fetch(`/api/ujian?action=available&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json())
    setAvailable(r.data || [])
    setLoading(false)
  }

  useEffect(() => { loadAvailable() }, [])

  // FIX #8: TTS Arabic untuk soal audio (kalau soal.audioUrl kosong, pakai TTS device)
  // Web Speech API: filter voice dengan lang.startsWith('ar'), limit 2x play anti-cheat
  const tts = useTTS()
  function playArabicTTS(text: string) {
    if (!tts.supported) {
      toast({ title: 'TTS tidak didukung browser ini', description: 'Pakai Chrome/Safari terbaru', variant: 'destructive' })
      return
    }
    if (tts.arabicVoices.length === 0) {
      toast({ title: 'Voice Arabic tidak tersedia', description: 'Install voice Arabic di OS device Anda', variant: 'destructive' })
      return
    }
    if (tts.playCount >= tts.maxPlay) {
      toast({ title: '⚠️ Limit play tercapai', description: `Maksimal ${tts.maxPlay}x play per soal (anti-cheat)`, variant: 'destructive' })
      return
    }
    tts.speak(text)
  }

  async function startUjian(sesi: any) {
    setLoading(true)
    setActiveSesi(sesi)
    setDone(false)
    // Get detail sesi + cek apakah sudah ada hasil
    const r = await fetch(`/api/ujian?action=detail&sesiId=${sesi.id}&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json())
    const data = r.data
    setActiveSesi(data.sesi)
    setHasil(data.hasil)

    // Start jika belum ada
    if (!data.hasil || data.hasil.status === 'ongoing') {
      const startR = await fetch(`/api/ujian?action=start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesiId: sesi.id, mahasiswaId: session.mahasiswa.id }),
      }).then(r => r.json())
      setHasil(startR.data)
    }

    // Init jawaban — FIX v3.2.0 #2: restore dari localStorage kalau mhs keluar & balik lagi
    // FIX v3.2.2: juga restore dari server (hasil.detail) sebagai backup kalau localStorage kosong/kosong
    let initJ: Record<string, string> = restoreJawabanFromLocalStorage(sesi.id, session.mahasiswa.id)

    // FIX v3.2.2: kalau localStorage kosong, cek hasil.detail dari server
    // (kalau mhs pernah submit tapi gagal/re-submit, DetailHasil mungkin ada)
    if (Object.keys(initJ).length === 0 && data.hasil?.detail && data.hasil.detail.length > 0) {
      for (const d of data.hasil.detail) {
        if (d.jawaban) {
          initJ[d.soalId] = d.jawaban
        }
      }
    }

    const initM: Record<string, string> = {}
    for (const s of data.sesi.soal) {
      if (s.jenis === 'matching' && s.opsiJson) {
        const opsi = JSON.parse(s.opsiJson)
        opsi.shuffled?.forEach((sh: any) => {
          // initial: kosong
        })
      }
    }
    setJawaban(initJ)
    setMatchingAnswer(initM)
    setCurrentIdx(0)
    setLoading(false)
  }

  function setJawabanForSoal(soalId: string, val: string) {
    setJawaban(prev => {
      const next = { ...prev, [soalId]: val }
      // FIX v3.2.0 #2: auto-save jawaban ke localStorage supaya kalau mhs keluar & balik lagi,
      // jawaban tetap ada (tidak reset ke kosong). Key: ujian-jawaban-{sesiId}-{mahasiswaId}.
      try {
        if (activeSesi && session?.mahasiswa?.id) {
          localStorage.setItem(
            `ujian-jawaban-${activeSesi.id}-${session.mahasiswa.id}`,
            JSON.stringify(next)
          )
        }
      } catch {}
      return next
    })
  }

  // FIX v3.2.0 #2: restore jawaban dari localStorage kalau mhs keluar & balik lagi.
  // Dipanggil saat init jawaban di loadDetail().
  function restoreJawabanFromLocalStorage(sesiId: string, mahasiswaId: string): Record<string, string> {
    try {
      const saved = localStorage.getItem(`ujian-jawaban-${sesiId}-${mahasiswaId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {}
    return {}
  }

  // FIX v3.2.0 #2: clear jawaban dari localStorage setelah submit sukses.
  function clearJawabanFromLocalStorage(sesiId: string, mahasiswaId: string) {
    try {
      localStorage.removeItem(`ujian-jawaban-${sesiId}-${mahasiswaId}`)
    } catch {}
  }

  function setMatchingForLeft(leftArabic: string, rightArti: string) {
    setMatchingAnswer(prev => ({ ...prev, [leftArabic]: rightArti }))
  }

  async function submit() {
    if (!activeSesi || !hasil) return
    if (!confirm('Kumpulkan jawaban? Setelah dikumpulkan tidak bisa diubah.')) return

    setSubmitting(true)
    const jawabanArr: any[] = []

    for (const s of activeSesi.soal) {
      if (s.jenis === 'matching') {
        // Build matching pairs
        const opsi = s.opsiJson ? JSON.parse(s.opsiJson) : null
        const pairs = opsi?.pairs?.map((p: any) => ({
          left: p.arabic,
          right: matchingAnswer[p.arabic] || '',
        })) || []
        jawabanArr.push({ soalId: s.id, jawaban: JSON.stringify(pairs) })
      } else if (s.jenis === 'sambung') {
        // FIX v3.0.7 #7: sambung jawaban format JSON { aIdx: bOriginalIdx }
        jawabanArr.push({ soalId: s.id, jawaban: jawaban[s.id] || '{}' })
      } else if (s.jenis === 'audio') {
        // Audio sekarang: mahasiswa dengarkan + jawab teks (auto-koreksi)
        jawabanArr.push({ soalId: s.id, jawaban: jawaban[s.id] || '' })
      } else {
        jawabanArr.push({ soalId: s.id, jawaban: jawaban[s.id] || '' })
      }
    }

    try {
      const res = await fetch('/api/ujian?action=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasilId: hasil.id, jawaban: jawabanArr }),
      })
      const r = await res.json()

      if (r.data) {
        setHasil(r.data)
        setDone(true)
        // FIX v3.2.0 #2: clear jawaban dari localStorage setelah submit sukses
        if (activeSesi && session?.mahasiswa?.id) {
          clearJawabanFromLocalStorage(activeSesi.id, session.mahasiswa.id)
        }
        toast({ title: 'Jawaban terkumpul!' })
      } else if (r.error) {
        // FIX v3.2.0 #2: kalau submit gagal (mis. deadline passed), toast error TAPI tetap simpan jawaban
        // ke localStorage supaya mhs gak kehilangan jawaban saat re-enter.
        toast({ title: 'Gagal submit', description: r.error, variant: 'destructive' })
      }
    } catch (e: any) {
      // FIX v3.2.0 #2: network error — jawaban TETAP di localStorage (auto-save saat setJawabanForSoal).
      // Mhs bisa refresh / re-enter dan jawaban tetap ada.
      toast({ title: 'Network error', description: 'Jawaban tersimpan lokal. Coba submit lagi.', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  async function loadDetail(sesiId: string) {
    const r = await fetch(`/api/ujian?action=detail&sesiId=${sesiId}&mahasiswaId=${session.mahasiswa.id}`).then(r => r.json())
    const data = r.data
    setActiveSesi(data.sesi)
    setHasil(data.hasil)
    setJawaban({})
    setMatchingAnswer({})
    setCurrentIdx(0)
  }

  // FIX: Hapus dead code (handleRetry, evaluasiData, evaluasiLoading, loadEvaluasi) — fitur kunci jawaban + tes ulang sudah dihapus
  if (loading) return <Loading />

  if (done && hasil) {
    const skor = hasil.skorTotal || 0
    const grade = getGrade(skor)
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <MumtazCelebration show={grade.isMumtaz} />
        <Card className="text-center border-0 shadow-float animate-pop-in">
          <CardHeader>
            <CardTitle className="text-2xl font-display text-gray-900">Jawaban Terkumpul!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-gray-500">Skor Anda:</p>
              <p className={`text-6xl font-bold ${grade.color}`}>{skor.toFixed(1)}%</p>
              <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full ${grade.bgClass}`}>
                <span className={`font-arabic text-2xl ${grade.color}`}>{grade.arabic}</span>
                <span className={`text-sm font-semibold ${grade.color}`}>({grade.letter})</span>
              </div>
              <p className="text-sm text-gray-500">Benar: {hasil.jumlahBenar}/{hasil.jumlahSoal} soal</p>
            </div>

            {/* Share WA button — Fitur #6 */}
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button
                onClick={shareWhatsApp}
                variant="outline"
                className="rounded-xl bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share Hasil ke WhatsApp
              </Button>
            </div>

            {/* FIX #8: Hapus fitur kunci jawaban + tes ulang (sesuai request user) */}

            <Button onClick={() => { setActiveSesi(null); setDone(false); loadAvailable() }} variant="outline" className="rounded-xl">
              Kembali ke Daftar Tes
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // FIX #8: Evaluasi view + kunci jawaban + tes ulang DIHAPUS TOTAL (sesuai request user)
  // Semua function viewEvaluasi, loadEvaluasi, handleRetry, evaluasiData, evaluasiLoading juga dihapus

  // FIX #9: Filter available ujian by tanggalMulai
  const now = new Date()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date()
  startYesterday.setDate(startYesterday.getDate() - 1)
  startYesterday.setHours(0, 0, 0, 0)
  const start7Days = new Date()
  start7Days.setDate(start7Days.getDate() - 7)
  start7Days.setHours(0, 0, 0, 0)

  const filteredAvailable = available.filter(s => {
    if (!s.tanggalMulai) return filterHari === 'all'
    const tgl = new Date(s.tanggalMulai)
    if (filterHari === 'today') return tgl >= startOfToday
    if (filterHari === 'yesterday') return tgl >= startYesterday && tgl < startOfToday
    if (filterHari === '7days') return tgl >= start7Days
    return true // 'all'
  })

  // FIX #4 user: copyHasil pakai format yang SAMA dengan shareHasilWA (formatHasilUjianMessage)
  function copyHasil(s: any) {
    if (!s.hasil?.length || s.hasil[0].status !== 'submitted') return
    const h = s.hasil[0]
    const skor = h.skorTotal || 0
    const grade = getGrade(skor)
    const message = formatHasilUjianMessage({
      mahasiswaNama: session.mahasiswa.nama,
      mahasiswaNim: session.mahasiswa.nim,
      sesiNama: s.nama,
      skor,
      jumlahBenar: h.jumlahBenar || 0,
      jumlahSoal: h.jumlahSoal || 0,
      gradeArabic: grade.arabic,
      gradeLetter: grade.letter,
      appUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
    })
    navigator.clipboard?.writeText(message).then(() => {
      toast({ title: '✅ Hasil disalin', description: 'Paste ke WhatsApp/Telegram' })
    }).catch(() => {})
  }

  // FIX #9: Share hasil ke WhatsApp
  function shareHasilWA(s: any) {
    if (!s.hasil?.length || s.hasil[0].status !== 'submitted') return
    const h = s.hasil[0]
    const message = formatHasilUjianMessage({
      mahasiswaNama: session.mahasiswa.nama,
      mahasiswaNim: session.mahasiswa.nim,
      sesiNama: s.nama,
      skor: h.skorTotal || 0,
      jumlahBenar: h.jumlahBenar || 0,
      jumlahSoal: h.jumlahSoal || 0,
    })
    openWhatsAppShare(null, message)
  }

  if (!activeSesi) {
    return (
      <div className="space-y-6">
        {/* FIX #9: Header minimalis + dropdown filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-ink">Tes</h2>
            <p className="text-sm text-ink-soft mt-1">{session.mahasiswa.nama}</p>
          </div>
          {/* Dropdown filter per hari */}
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
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:text-ink border border-ink-trace'
                }`}
                style={{ borderRadius: 0 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredAvailable.length === 0 ? (
          <EmptyState title="Belum ada ujian" description="Tunggu penguji membuka sesi ujian" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAvailable.map(s => {
              const isDone = s.hasil?.length > 0 && s.hasil[0].status === 'submitted'
              const isLocked = s.deadlinePassed && !isDone
              return (
                <Card key={s.id} className={
                  isLocked ? 'border-rose-300 bg-rose-50/20' :
                  isDone ? 'border-ink-trace bg-paper-white' :
                  'border-emerald-200 bg-emerald-50/10'
                }>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold text-ink leading-tight">{s.nama}</CardTitle>
                      {isLocked ? (
                        <span className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">Terkunci</span>
                      ) : isDone ? (
                        <span className="text-[10px] uppercase tracking-wider text-green-stiba font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Selesai
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Aktif</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-[10px] text-ink-soft">
                      <span>{s.level?.nama}</span>
                      <span>·</span>
                      <span>{s.durasiMenit}m</span>
                      <span>·</span>
                      <span>{s._count?.soal ?? 0} soal</span>
                      {s.jamSelesai && (
                        <>
                          <span>·</span>
                          <span className="text-rose-600 font-semibold">⏰ {s.jamSelesai}</span>
                        </>
                      )}
                    </div>

                    {/* FIX #9: Skor kalau sudah selesai */}
                    {isDone && (
                      <p className="text-sm font-bold text-ink">
                        {s.hasil[0].skorTotal?.toFixed(1) || 0}%
                        <span className="text-xs font-normal text-ink-soft ml-1">
                          · {s.hasil[0].jumlahBenar || 0}/{s.hasil[0].jumlahSoal || 0}
                        </span>
                      </p>
                    )}
                    {isLocked && !isDone && (
                      <p className="text-[10px] text-rose-600">Tidak dikerjakan</p>
                    )}

                    {/* FIX #9: Tombol play/share/copy minimalis */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-ink-trace">
                      {/* Play button — mulai/lanjutkan ujian */}
                      {!isLocked && (
                        <button
                          onClick={() => startUjian(s)}
                          disabled={isDone}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition ${
                            isDone
                              ? 'text-ink-faint cursor-not-allowed'
                              : 'bg-green-stiba text-paper hover:bg-green-deep'
                          }`}
                          style={{ borderRadius: 0 }}
                        >
                          <Play className="w-3 h-3" />
                          {isDone ? 'Selesai' : s.hasil?.length > 0 ? 'Lanjut' : 'Mulai'}
                        </button>
                      )}

                      {/* Share WA — disabled kalau belum selesai (washout) */}
                      <button
                        onClick={() => shareHasilWA(s)}
                        disabled={!isDone}
                        className={`flex items-center gap-1 px-2 py-1.5 text-xs transition ${
                          isDone
                            ? 'text-ink hover:bg-ink-trace'
                            : 'text-ink-faint opacity-40 cursor-not-allowed'
                        }`}
                        style={{ borderRadius: 0 }}
                        title={isDone ? 'Share ke WhatsApp' : 'Selesaikan ujian dulu'}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Copy hasil — disabled kalau belum selesai (washout) */}
                      <button
                        onClick={() => copyHasil(s)}
                        disabled={!isDone}
                        className={`flex items-center gap-1 px-2 py-1.5 text-xs transition ${
                          isDone
                            ? 'text-ink hover:bg-ink-trace'
                            : 'text-ink-faint opacity-40 cursor-not-allowed'
                        }`}
                        style={{ borderRadius: 0 }}
                        title={isDone ? 'Copy hasil' : 'Selesaikan ujian dulu'}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Active ujian
  const soalList = activeSesi.soal || []
  const currentSoal = soalList[currentIdx]
  const progress = ((currentIdx + 1) / soalList.length) * 100

  function renderSoal(soal: any) {
    if (!soal) return null

    // Helper: convert YouTube URL to embed URL
    function youtubeToEmbed(url: string): string {
      if (!url) return ''
      // Already embed
      if (url.includes('/embed/')) return url
      // youtube.com/watch?v=XXX
      const watchMatch = url.match(/[?&]v=([^&]+)/)
      if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`
      // youtu.be/XXX
      const shortMatch = url.match(/youtu\.be\/([^?]+)/)
      if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`
      return url
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="info">{soal.jenis}</Badge>
        </div>

        <p className="text-gray-800">{soal.pertanyaan}</p>

        {/* Display Arabic prompt if any */}
        {soal.pertanyaanArabic && (
          <div className="p-4 bg-emerald-50 rounded-lg text-right">
            <ArabicText size="xl" className="text-emerald-800">{soal.pertanyaanArabic}</ArabicText>
          </div>
        )}

        {/* MEDIA: gambar, video, audio, embed — tampil untuk SEMUA jenis soal */}
        {soal.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            {/* FIX v2.9.9: tercrop square 1:1 (sebelumnya object-contain max-h-80 yang
                menampilkan full image tanpa crop). User mau konsisten square crop untuk
                materi, paket, dan soal. */}
            <div className="aspect-square bg-gray-50">
              <img src={soal.imageUrl} alt="gambar soal" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        {soal.videoUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            {soal.videoUrl.includes('youtube.com') || soal.videoUrl.includes('youtu.be') ? (
              <iframe
                src={youtubeToEmbed(soal.videoUrl)}
                className="w-full aspect-video"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <video controls src={soal.videoUrl} className="w-full max-h-80" preload="metadata" />
            )}
          </div>
        )}
        {soal.audioUrl && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs text-emerald-700 font-semibold mb-1">🎧 Audio</p>
            <audio controls src={soal.audioUrl} className="w-full" preload="metadata" />
          </div>
        )}
        {/* FIX #8: Opsi TTS Arabic (kalau soal.audioUrl kosong + ada teks Arabic) */}
        {/* Pakai Web Speech API — device TTS, gratis, no API */}
        {!soal.audioUrl && soal.jawabanBenar && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-emerald-700 font-semibold">🔊 Setoran Hafalan Lisan (TTS Device)</p>
              {tts.speaking && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
            </div>
            <p className="text-xs text-emerald-600 mb-2">
              Klik tombol untuk dengar lafaz Arabic. Limit {tts.maxPlay}x play (anti-cheat).
              Sudah diputar: {tts.playCount}/{tts.maxPlay}x
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                type="button"
                onClick={() => playArabicTTS(soal.jawabanBenar)}
                disabled={tts.playCount >= tts.maxPlay || tts.speaking}
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                <Volume2 className="w-3.5 h-3.5 mr-1" />
                {tts.speaking ? 'Sedang main...' : '▶ Putar Audio'}
              </Button>
              {tts.speaking && (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => tts.stop()}
                  className="rounded-xl"
                >
                  <VolumeX className="w-3.5 h-3.5 mr-1" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        )}
        {soal.embedUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <iframe src={soal.embedUrl} className="w-full min-h-[200px]" allowFullScreen />
          </div>
        )}

        {/* MCQ — FIX v3.0.7 #5: opsi sekarang bisa punya gambar + audio. opsiJson format:
            - Old: array of strings ["text1", "text2", ...]
            - New: array of objects [{text, imageUrl?, audioUrl?}, ...]
            Both supported (auto-detect). */}
        {soal.jenis === 'mcq' && (() => {
          // Parse opsiJson — handle both string array (old) and object array (new)
          let opsiList: { text: string; imageUrl?: string; audioUrl?: string }[] = []
          try {
            const parsed = JSON.parse(soal.opsiJson || '[]')
            opsiList = parsed.map((o: any) => typeof o === 'string' ? { text: o } : o)
          } catch { opsiList = [] }
          return (
            <RadioGroup
              value={jawaban[soal.id] || ''}
              onValueChange={(v) => setJawabanForSoal(soal.id, v)}
              className="space-y-2"
            >
              {opsiList.map((opsi, i) => (
                <div key={i} className="flex items-start space-x-2 p-2 border rounded hover:bg-gray-50">
                  <RadioGroupItem value={opsi.text} id={`${soal.id}-${i}`} className="mt-1" />
                  <div className="flex-1 cursor-pointer" onClick={() => setJawabanForSoal(soal.id, opsi.text)}>
                    <Label htmlFor={`${soal.id}-${i}`} className="cursor-pointer block">
                      {opsi.imageUrl && (
                        <div className="aspect-square w-16 h-16 rounded-lg overflow-hidden bg-gray-100 mb-1">
                          <img src={opsi.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="font-arabic text-lg" dir="rtl">{opsi.text}</span>
                      {opsi.audioUrl && (
                        <audio controls src={opsi.audioUrl} className="w-full h-8 mt-1" preload="none" />
                      )}
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          )
        })()}

        {/* FIX v3.0.7 #6: kalau soal.isAudio = true, tampilkan audio player TTS (Web Speech API).
            Pakai hook useTTS yang sudah ada (line 75). TTS Arabic native browser, gratis.
            Anti-cheat: max 2x play per soal. */}
        {soal.isAudio && soal.pertanyaanArabic && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-emerald-700">🎧 Audio Soal (TTS Arabic)</p>
            <p className="text-xs text-gray-500">
              Klik tombol untuk dengar lafaz Arabic. Limit {tts.maxPlay}x play (anti-cheat).
              Sudah diputar: {tts.playCount}/{tts.maxPlay}x
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!tts.supported) {
                  toast({ title: 'Browser tidak support TTS', variant: 'destructive' })
                  return
                }
                if (tts.arabicVoices.length === 0) {
                  toast({ title: 'Arabic voice tidak tersedia', description: 'Install Arabic voice di OS', variant: 'destructive' })
                  return
                }
                if (tts.playCount >= tts.maxPlay) {
                  toast({ title: '⚠️ Limit play tercapai', variant: 'destructive' })
                  return
                }
                tts.speak(soal.pertanyaanArabic)
              }}
              disabled={tts.playCount >= tts.maxPlay || tts.speaking}
              className="rounded-xl"
            >
              {tts.speaking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              {tts.speaking ? 'Sedang main...' : '▶ Putar Audio Soal'}
            </Button>
            {/* Hidden Arabic text — tampilkan supaya kalau TTS gak support, mhs masih bisa lihat text */}
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-400">Lihat teks (fallback)</summary>
              <ArabicText size="lg" className="text-emerald-800 mt-1">{soal.pertanyaanArabic}</ArabicText>
            </details>
          </div>
        )}

        {/* FIX v3.2.4: soal sambung dengan UI sambung kabel (seperti Among Us wire-fix).
            FIX v3.2.5 #3: key={soal.id} supaya component re-mount per soal (shuffledB re-init). */}
        {soal.jenis === 'sambung' && soal.pairsJson && (
          <SambungCableGame
            key={soal.id}
            pairsJson={soal.pairsJson}
            currentAnswer={jawaban[soal.id] || '{}'}
            onAnswerChange={(val) => setJawabanForSoal(soal.id, val)}
          />
        )}

        {/* Isian */}
        {soal.jenis === 'isian' && (
          <div className="space-y-2">
            <Input
              value={jawaban[soal.id] || ''}
              onChange={(e) => setJawabanForSoal(soal.id, e.target.value)}
              dir="rtl"
              className="font-arabic text-right text-2xl"
              placeholder="اكتب الجواب هنا"
            />
          </div>
        )}
      </div>
    )
  }

  // FIX #1 user: hapus overlay hitam sepenuhnya. Anti-cheat cuma block (silent), gak ada overlay.
  return (
    <div className="space-y-6 anti-cheat-zone">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => { setActiveSesi(null); loadAvailable() }} className="mb-2 no-print">← Keluar</Button>
          <h2 className="text-2xl font-bold text-gray-900">{activeSesi.nama}</h2>
          <p className="text-sm text-gray-500 mt-1">{activeSesi.level?.nama} &middot; {activeSesi.durasiMenit} menit</p>
        </div>
        <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 no-print">
          {submitting ? 'Menyimpan...' : 'Kumpulkan'}
        </Button>
      </div>

      <div className="no-print">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Soal {currentIdx + 1} dari {soalList.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardContent className="p-6">
          {renderSoal(currentSoal)}
        </CardContent>
      </Card>

      {/* Quick nav: grid 5-6 kolom compact, scrollable horizontal di mobile */}
      <div className="no-print bg-white rounded-2xl border border-gray-200 p-3 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600">Navigasi Soal</p>
          <span className="text-xs text-gray-500">{currentIdx + 1} / {soalList.length}</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-32 overflow-y-auto scroll-thin">
          {soalList.map((s, i) => {
            const isAnswered = jawaban[s.id] || (s.jenis === 'matching' && Object.keys(matchingAnswer).length > 0)
            return (
              <button
                key={s.id}
                onClick={() => setCurrentIdx(i)}
                className={`aspect-square rounded-lg text-xs font-semibold transition-all ${
                  i === currentIdx
                    ? 'bg-[oklch(0.50_0.18_265)] text-white shadow-soft scale-105'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nav buttons — compact inline, no more space waste */}
      <div className="flex items-center justify-between gap-2 no-print">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="rounded-xl flex-1 sm:flex-none"
        >← Sebelumnya</Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIdx(Math.min(soalList.length - 1, currentIdx + 1))}
          disabled={currentIdx === soalList.length - 1}
          className="rounded-xl flex-1 sm:flex-none"
        >Berikutnya →</Button>
      </div>
    </div>
  )
}

// Matching Question component
function MatchingQuestion({ opsi, answer, onAnswer }: { opsi: any; answer: Record<string, string>; onAnswer: (left: string, right: string) => void }) {
  if (!opsi?.pairs || !opsi?.shuffled) return null
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Pasangkan Arabic (kanan) dengan artinya (kiri):</p>
      <div className="space-y-2">
        {opsi.shuffled.map((right: any, i: number) => {
          const leftItem = opsi.pairs[i]
          return (
            <div key={i} className="flex items-center gap-3 p-2 border rounded">
              <div className="flex-1 text-right">
                <ArabicText size="md" className="text-gray-900">{leftItem.arabic}</ArabicText>
              </div>
              <select
                value={answer[leftItem.arabic] || ''}
                onChange={(e) => onAnswer(leftItem.arabic, e.target.value)}
                className="flex-2 border rounded px-2 py-1 text-sm"
              >
                <option value="">— pilih arti —</option>
                {opsi.shuffled.map((s: any, j: number) => (
                  <option key={j} value={s.arti}>{s.arti}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ===== FIX v3.2.8: SambungCableGame — proper bezier curves, ports face each other
// Layout: Kolom A kiri (text kanan, dot di ujung kanan) | Kolom B kanan (text kiri, dot di ujung kiri)
// Tali = SVG cubic bezier dari dot A (kanan) ke dot B (kiri) — curve natural, bukan lurus.
// Drag A→B atau B→A. Click tali = putus. Support extras (distractors).
// FIX v3.2.8 #1: state-based port positions (useLayoutEffect) — cables no longer render at fallback
//   positions during the brief window between mount and ref-set. Fixes "messy after navigation" bug.
// FIX v3.2.8 #2: SVG cables get pointerEvents='none' during drag — elementFromPoint now returns the
//   underlying HTML card, avoiding the "correspondingUseElement" permission error in Turbopack/FF.
// FIX v3.2.9 #2: export SambungCableGame supaya bisa dipakai di SesiView (Uji Coba mode)
export function SambungCableGame({ pairsJson, currentAnswer: answerStr, onAnswerChange }: {
  pairsJson: string
  currentAnswer: string
  onAnswerChange: (val: string) => void
}) {
  // FIX v3.3.10: useMemo supaya pairsData stabil (TIDAK re-create setiap render)
  // Sebelumnya: inline (() => JSON.parse(pairsJson))() → pairs reference beda setiap render
  // → useCallback([pairs, bItems]) recreate measurePositions → useLayoutEffect re-run
  // → setPortPositions triggers re-render → INFINITE LOOP "Maximum update depth exceeded"
  const pairsData = useMemo(() => {
    try { return JSON.parse(pairsJson) } catch { return { pairs: [] } }
  }, [pairsJson])
  const pairs = pairsData.pairs || []
  const extras = pairsData.extras || []

  const [bItems] = useState(() => {
    const real = pairs.map((_: any, idx: number) => ({ text: pairs[idx].b?.text || '', imageUrl: pairs[idx].b?.imageUrl, audioUrl: pairs[idx].b?.audioUrl, originalIdx: idx, isExtra: false }))
    const extra = extras.map((e: any, i: number) => ({ text: e.text || '', originalIdx: -1 - i, isExtra: true }))
    return [...real, ...extra].sort(() => Math.random() - 0.5)
  })

  const [dragFrom, setDragFrom] = useState<{ side: 'A' | 'B'; idx: number } | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverTarget, setHoverTarget] = useState<{ side: 'A' | 'B'; idx: number } | null>(null)
  const [portPositions, setPortPositions] = useState<{
    a: Record<number, { x: number; y: number }>
    b: Record<number, { x: number; y: number }>
  }>({ a: {}, b: {} })

  const containerRef = useRef<HTMLDivElement>(null)
  const aRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const bRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const currentAnswer = (() => {
    try { return JSON.parse(answerStr || '{}') } catch { return {} }
  })()

  // FIX v3.3.10: responsive dimensions + more spacing + smaller Indonesian font
  // User request: "A lebih ke kiri, B lebih ke kanan, kecilkan font indonesia, spacing samping & atas/bawah"
  const [screenW, setScreenW] = useState(0)
  useEffect(() => {
    const updateW = () => setScreenW(window.innerWidth)
    updateW()
    window.addEventListener('resize', updateW)
    return () => window.removeEventListener('resize', updateW)
  }, [])
  const isMobile = screenW > 0 && screenW < 640
  const ITEM_GAP = isMobile ? 10 : 14    // FIX v3.3.10: lebih besar jarak antar item (atas/bawah)
  const NODE_H = isMobile ? 52 : 56     // FIX v3.3.10: lebih tinggi supaya text muat
  const PORT_R = isMobile ? 6 : 7
  const CARD_W = isMobile ? 120 : 140   // FIX v3.3.10: sedikit lebih kecil supaya GAP bisa lebih besar
  const GAP = isMobile ? 60 : 100       // FIX v3.3.10: NAIK dari 80 → 100 (desktop) / 60 (mobile) supaya A & B lebih berjauhan
  const containerWidth = CARD_W * 2 + GAP
  const [containerHeight, setContainerHeight] = useState(Math.max(pairs.length, bItems.length) * (NODE_H + ITEM_GAP) + 20)
  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#06b6d4', '#f97316']

  // FIX v3.3.10: measure port positions — useCallback dengan deps stabil (pairs dari useMemo)
  const measurePositions = useCallback(() => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const aPos: Record<number, { x: number; y: number }> = {}
    const bPos: Record<number, { x: number; y: number }> = {}

    for (let i = 0; i < pairs.length; i++) {
      const el = aRefs.current[i]
      if (el) {
        const portEl = el.querySelector('[data-a-port]') as HTMLElement
        if (portEl) {
          const r = portEl.getBoundingClientRect()
          aPos[i] = { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top }
        }
      }
    }
    for (const b of bItems) {
      const el = bRefs.current[b.originalIdx]
      if (el) {
        const portEl = el.querySelector('[data-b-port]') as HTMLElement
        if (portEl) {
          const r = portEl.getBoundingClientRect()
          bPos[b.originalIdx] = { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top }
        }
      }
    }
    setPortPositions({ a: aPos, b: bPos })

    // FIX v3.3.10: dynamic containerHeight — measure max item height (text bisa wrap)
    let maxH = 0
    for (let i = 0; i < pairs.length; i++) {
      const el = aRefs.current[i]
      if (el && el.offsetHeight > maxH) maxH = el.offsetHeight
    }
    for (const b of bItems) {
      const el = bRefs.current[b.originalIdx]
      if (el && el.offsetHeight > maxH) maxH = el.offsetHeight
    }
    const newH = (maxH + ITEM_GAP) * Math.max(pairs.length, bItems.length) + 20
    if (newH > 0) setContainerHeight(newH)
  }, [pairs, bItems, ITEM_GAP])

  useLayoutEffect(() => {
    measurePositions()
    const raf = requestAnimationFrame(measurePositions)
    const t = setTimeout(measurePositions, 100)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [measurePositions])

  useEffect(() => {
    const onResize = () => measurePositions()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [measurePositions])

  const getAPort = (aIdx: number) => portPositions.a[aIdx] || { x: CARD_W, y: aIdx * (NODE_H + ITEM_GAP) + NODE_H / 2 + 10 }
  const getBPort = (bOriginalIdx: number) => portPositions.b[bOriginalIdx] || { x: CARD_W + GAP, y: 0 }

  const startDrag = (e: React.PointerEvent, side: 'A' | 'B', idx: number) => {
    const answerKey = side === 'A' ? String(idx) : null
    const reverseKey = side === 'B' ? Object.entries(currentAnswer).find(([, v]) => Number(v) === idx)?.[0] : null
    const connectedKey = answerKey || reverseKey
    if (connectedKey && currentAnswer[connectedKey] !== undefined) {
      const next = { ...currentAnswer }
      delete next[connectedKey]
      onAnswerChange(JSON.stringify(next))
      return
    }
    e.preventDefault()
    setDragFrom({ side, idx })
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  useEffect(() => {
    if (!dragFrom) return
    const handleMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        const el = document.elementFromPoint(e.clientX, e.clientY)
        if (!el) { setHoverTarget(null); return }
        try {
          const aIdx = (el as HTMLElement).closest?.('[data-a-idx]')?.getAttribute('data-a-idx')
          const bIdx = (el as HTMLElement).closest?.('[data-b-idx]')?.getAttribute('data-b-idx')
          if (dragFrom.side === 'A' && bIdx) setHoverTarget({ side: 'B', idx: Number(bIdx) })
          else if (dragFrom.side === 'B' && aIdx) setHoverTarget({ side: 'A', idx: Number(aIdx) })
          else setHoverTarget(null)
        } catch {
          setHoverTarget(null)
        }
      }
    }
    const handleUp = (e: PointerEvent) => {
      if (dragFrom) {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        if (el) {
          try {
            const aIdx = (el as HTMLElement).closest?.('[data-a-idx]')?.getAttribute('data-a-idx')
            const bIdx = (el as HTMLElement).closest?.('[data-b-idx]')?.getAttribute('data-b-idx')
            if (dragFrom.side === 'A' && bIdx) {
              const next: any = { ...currentAnswer }
              for (const [k, v] of Object.entries(next)) { if (Number(v) === Number(bIdx)) delete next[k] }
              next[String(dragFrom.idx)] = Number(bIdx)
              onAnswerChange(JSON.stringify(next))
            } else if (dragFrom.side === 'B' && aIdx) {
              const next: any = { ...currentAnswer }
              for (const [k, v] of Object.entries(next)) { if (Number(v) === dragFrom.idx) delete next[k] }
              next[String(aIdx)] = dragFrom.idx
              onAnswerChange(JSON.stringify(next))
            }
          } catch { /* ignore */ }
        }
      }
      setDragFrom(null)
      setDragPos(null)
      setHoverTarget(null)
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }
  }, [dragFrom, currentAnswer, onAnswerChange])

  if (pairs.length === 0) return null

  const buildPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const cp1x = x1 + dx * 0.5
    const cp1y = y1
    const cp2x = x2 - dx * 0.5
    const cp2y = y2
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
  }

  const dragStart = dragFrom ? (dragFrom.side === 'A' ? getAPort(dragFrom.idx) : getBPort(dragFrom.idx)) : { x: 0, y: 0 }
  const dragColor = dragFrom ? (dragFrom.side === 'A' ? COLORS[dragFrom.idx % COLORS.length] : '#6b7280') : '#10b981'
  const cablePointerEvents = dragFrom ? 'none' : 'all'

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500">Tarik dari titik ke titik. Klik tali untuk putuskan.</p>
      <div ref={containerRef} className="relative select-none mx-auto" style={{ width: containerWidth, height: containerHeight, touchAction: 'none' }}>
        <svg className="absolute inset-0" style={{ zIndex: 1, pointerEvents: 'none', width: '100%', height: '100%' }}>
          {Object.entries(currentAnswer).map(([aIdx, bOriginalIdx]) => {
            const aPort = getAPort(Number(aIdx))
            const bPort = getBPort(Number(bOriginalIdx))
            const color = COLORS[Number(aIdx) % COLORS.length]
            return (
              <g key={aIdx} style={{ pointerEvents: cablePointerEvents, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); const next = { ...currentAnswer }; delete next[aIdx]; onAnswerChange(JSON.stringify(next)) }}>
                <path d={buildPath(aPort.x, aPort.y, bPort.x, bPort.y)} stroke="transparent" strokeWidth="16" fill="none" />
                <path d={buildPath(aPort.x, aPort.y, bPort.x, bPort.y)} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d={buildPath(aPort.x, aPort.y, bPort.x, bPort.y)} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.15" />
              </g>
            )
          })}
          {dragFrom && dragPos && (
            <>
              <path d={buildPath(dragStart.x, dragStart.y, dragPos.x, dragPos.y)} stroke={dragColor} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.15" />
              <path d={buildPath(dragStart.x, dragStart.y, dragPos.x, dragPos.y)} stroke={dragColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="5 4" opacity="0.8" />
            </>
          )}
        </svg>

        {/* Kolom A (kiri) — Arabic text, dot di ujung kanan */}
        {/* FIX v3.3.10: minHeight (bukan height) supaya text bisa wrap, marginBottom untuk spacing, no truncate */}
        <div className="absolute left-0 top-0" style={{ zIndex: 2 }}>
          {pairs.map((p: any, aIdx: number) => {
            const isConnected = currentAnswer[String(aIdx)] !== undefined
            const isDragging = dragFrom?.side === 'A' && dragFrom?.idx === aIdx
            const isHover = hoverTarget?.side === 'A' && hoverTarget?.idx === aIdx
            const color = COLORS[aIdx % COLORS.length]
            return (
              <div key={aIdx} ref={(el) => { aRefs.current[aIdx] = el }} data-a-idx={aIdx}
                onPointerDown={(e) => startDrag(e, 'A', aIdx)}
                className="flex items-center justify-end gap-2 transition-all"
                style={{ minHeight: NODE_H, width: CARD_W, marginBottom: ITEM_GAP, touchAction: 'none', cursor: isConnected ? 'pointer' : 'grab', transform: isHover ? 'scale(1.05)' : 'scale(1)' }}>
                <ArabicText size="sm" className="text-gray-900 leading-tight text-right">{p.a.text}</ArabicText>
                <div data-a-port className="rounded-full flex-shrink-0 transition-all" style={{
                  width: PORT_R * 2, height: PORT_R * 2, backgroundColor: color,
                  opacity: isConnected ? 0.35 : 1, transform: isDragging ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: isConnected ? 'none' : `0 0 8px ${color}99`,
                }} />
              </div>
            )
          })}
        </div>

        {/* Kolom B (kanan) — dot di ujung kiri, Indonesian text */}
        {/* FIX v3.3.10: text-xs (lebih kecil dari Arabic sm), minHeight, marginBottom, no truncate */}
        <div className="absolute top-0" style={{ zIndex: 2, left: CARD_W + GAP }}>
          {bItems.map((b: any) => {
            const isConnected = Object.values(currentAnswer).includes(b.originalIdx)
            const isDragging = dragFrom?.side === 'B' && dragFrom?.idx === b.originalIdx
            const isHover = hoverTarget?.side === 'B' && hoverTarget?.idx === b.originalIdx
            const connectedAIdx = Object.entries(currentAnswer).find(([, v]) => Number(v) === b.originalIdx)?.[0]
            const color = connectedAIdx !== undefined ? COLORS[Number(connectedAIdx) % COLORS.length] : '#d1d5db'
            return (
              <div key={b.originalIdx} ref={(el) => { bRefs.current[b.originalIdx] = el }} data-b-idx={b.originalIdx}
                onPointerDown={(e) => startDrag(e, 'B', b.originalIdx)}
                className="flex items-center gap-2 transition-all"
                style={{ minHeight: NODE_H, width: CARD_W, marginBottom: ITEM_GAP, touchAction: 'none', cursor: 'grab', transform: isHover ? 'scale(1.05)' : 'scale(1)' }}>
                <div data-b-port className="rounded-full flex-shrink-0 transition-all" style={{
                  width: PORT_R * 2, height: PORT_R * 2, backgroundColor: color,
                  opacity: isConnected ? 0.35 : 1, transform: isDragging ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: isConnected ? 'none' : `0 0 8px ${color}66`,
                }} />
                <ArabicText size="sm" className="text-gray-900 leading-tight">{b.text}</ArabicText>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
