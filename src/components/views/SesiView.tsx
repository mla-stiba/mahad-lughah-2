'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from '@/hooks/use-toast'
import { ArabicText, EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { FileUpload } from '@/components/shared/FileUpload'
import { getGrade } from '@/components/shared/grade'
import { SambungCableGame } from '@/components/views/UjianView'
import { Plus, Copy, Trash2, Shuffle, Settings2, FileCode2, Sparkles, Music, Edit2, Download, Eye, Image as ImageIcon, Video, Link as LinkIcon, Loader2, CheckCircle2, Play, ArrowLeft, ArrowRight } from 'lucide-react'
// FIX v2.9.9: hapus import RichTextEditor — tidak dipakai lagi (ganti dengan Textarea biasa).

export function SesiView() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<any[]>([])
  const [levelList, setLevelList] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [detailView, setDetailView] = useState<any | null>(null)
  const [materiList, setMateriList] = useState<any[]>([])

  const [form, setForm] = useState({
    nama: '', levelId: '', mode: 'online', durasiMenit: 30, aktif: true,
    acakUrutan: false, jumlahSoalPerMahasiswa: '' as string | number,
    tanggalMulai: new Date().toISOString().slice(0, 10),
    jamMulai: '', jamSelesai: '',
    gunakanFase: false,
  })

  // Soal builder form — FIX v3.2.1: tambah isAudio, pairs (sambung), opsiImages (MCQ media)
  const [soalForm, setSoalForm] = useState({
    jenis: 'isian' as 'isian' | 'mcq' | 'sambung',
    materiId: '',
    pertanyaan: '',
    pertanyaanArabic: '',
    opsi: ['', '', '', ''],
    opsiImages: ['', '', '', ''] as string[],  // FIX v3.2.1 #4: gambar URL per opsi MCQ
    jawabanBenar: '',
    jawabanBenarIndex: 0,
    audioUrl: '',
    imageUrl: '',
    videoUrl: '',
    embedUrl: '',
    fase: '',
    kategori: '',
    bobot: 1,
    isAudio: false,  // FIX v3.2.1 #5: flag TTS Arabic
    // FIX v3.2.8 #4: pairs support per-side media (aImage, aAudio, bImage, bAudio)
    pairs: [{ a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }] as { a: string; aImage?: string; aAudio?: string; b: string; bImage?: string; bAudio?: string }[],
    // FIX v3.3.0: extras (distractor B tanpa pasangan A) — untuk soal sambung
    extras: [{ text: '', imageUrl: '', audioUrl: '' }] as { text: string; imageUrl?: string; audioUrl?: string }[],
  })

  // Script generator — FIX: format disinkronkan dengan parser baru (api/sesi/route.ts)
  // Hindari prefix P:/AR:/J:/Opsi: — pakai "jawaban:", "alt:", "ar:" (untuk pertanyaanArabic),
  // dan markdown list "- [+]" untuk opsi MCQ.
  // FIX v3.0.7 #5/#6/#7: contoh baru — opsi MCQ dengan media, isAudio flag, sambung pairs
  // FIX v3.2.8 #3: contoh sambung dengan gambar/audio per pair A & B
  // FIX v3.2.9 #1: script example match exact format yang user minta (with comments)
  const [scriptText, setScriptText] = useState(`## 1. [isian]                  ← jenis: isian | mcq | sambung
Tuliskan bahasa Arab: ayah     ← pertanyaan (boleh multiline)

ar: أَبٌ                  ← pertanyaan versi Arabic (tampil terpisah)
jawaban: أَبٌ                  ← jawaban benar (untuk isian)
alt: abun, abu                ← (opsional) alternatif jawaban
audio: https://...mp3         ← (opsional) URL audio (untuk pertanyaan)
gambar: https://...jpg        ← (opsional) URL gambar (untuk pertanyaan)
isAudio: true                 ← (opsional v3.0.7 #6) flag — soal pakai TTS Arabic
fase: 1, kategori: Mufrodat, bobot: 1  ← (opsional)

## 2. [mcq]                   ← MCQ: opsi pakai markdown list, [+]=jawaban benar
Apa arti kata berikut? مُحَاضِرٌ ← (v3.0.7 #7) Pertanyaan indo/kode soal

ar: ← (v3.0.7 #7) Pertanyaan Arab
- [+] Dosen                   ← [+]=jawaban benar
  gambar: https://...jpg      ← (opsional v3.0.7 #5) gambar per opsi
  audio: https://...mp3       ← (opsional v3.0.7 #5) audio per opsi
- Guru SD
  gambar: https://...jpg
- Mahasiswa
- Kepala Sekolah

## 3. [sambung]               ← (v3.0.7 #7) NEW jenis — matching pairs
Pasangkan kata dengan artinya ← (v3.0.7 #7) Pertanyaan indo/kode soal

ar: صل بين الكلمات المناسبة ← (v3.0.7 #7) Pertanyaan arab
(1a) هذا                      ← format (Na) untuk kolom A, (Nb) untuk kolom B
(1b) كتاب                     ← N = nomor pair (harus sama untuk a & b)
(2a) هذه                      ← A dan B bisa ada gambar/audio (langsung di bawah pair)
(2b) مكنسة
  gambar: https://...jpg
(3a) باب
(3b) pintu

---                           ← pisah antar soal dengan ---

Jenis tersedia: isian, mcq, sambung
`)

  async function load() {
    setLoading(true)
    const [sR, lR] = await Promise.all([
      fetch('/api/sesi').then(r => r.json()),
      fetch('/api/master?action=level').then(r => r.json()),
    ])
    setList(sR.data || [])
    setLevelList(lR.data || [])
    setLoading(false)
  }

  async function loadDetail() {
    if (!detailView) return
    const res = await fetch(`/api/sesi?id=${detailView.id}`).then(r => r.json())
    setDetailView(res.data)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({
      nama: '', levelId: levelList[0]?.id || '', mode: 'online', durasiMenit: 30, aktif: true,
      acakUrutan: false, jumlahSoalPerMahasiswa: '',
      tanggalMulai: new Date().toISOString().slice(0, 10),
      jamMulai: '', jamSelesai: '',
      gunakanFase: false,
    })
    setDialogOpen(true)
  }

  function openEdit(s: any) {
    setEditing(s)
    setForm({
      nama: s.nama, levelId: s.levelId, mode: s.mode, durasiMenit: s.durasiMenit, aktif: s.aktif,
      acakUrutan: s.acakUrutan || false, jumlahSoalPerMahasiswa: s.jumlahSoalPerMahasiswa || '',
      tanggalMulai: s.tanggalMulai ? new Date(s.tanggalMulai).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      jamMulai: s.jamMulai || '', jamSelesai: s.jamSelesai || '',
      gunakanFase: s.gunakanFase || false,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.nama || !form.levelId) {
      toast({ title: 'Lengkapi data', variant: 'destructive' })
      return
    }
    const payload = {
      ...form,
      jumlahSoalPerMahasiswa: form.jumlahSoalPerMahasiswa === '' ? null : Number(form.jumlahSoalPerMahasiswa),
      tanggalMulai: form.tanggalMulai ? new Date(form.tanggalMulai) : new Date(),
    }
    const method = editing ? 'PATCH' : 'POST'
    const body = editing ? { id: editing.id, ...payload } : payload
    const res = await fetch('/api/sesi', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: editing ? 'Diperbarui' : 'Sesi dibuat' })
      setDialogOpen(false)
      load()
    } else {
      toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus sesi ini + semua soal & hasilnya?')) return
    await fetch(`/api/sesi?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Dihapus' })
    load()
  }

  async function openDetail(s: any) {
    const res = await fetch(`/api/sesi?id=${s.id}`).then(r => r.json())
    setDetailView(res.data)
    const matRes = await fetch(`/api/materi?levelId=${s.levelId}`).then(r => r.json())
    setMateriList(matRes.data || [])
    setSoalForm({
      jenis: 'isian', materiId: '', pertanyaan: '', pertanyaanArabic: '',
      opsi: ['', '', '', ''], opsiImages: ['', '', '', ''],
      jawabanBenar: '', jawabanBenarIndex: 0, audioUrl: '',
      imageUrl: '', videoUrl: '', embedUrl: '', fase: '', kategori: '',
      bobot: 1,
      isAudio: false,
      // FIX v3.2.8 #4: pairs support per-side media
      pairs: [{ a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }],
      // FIX v3.3.0: reset extras (distractor B)
      extras: [{ text: '', imageUrl: '', audioUrl: '' }],
    })
  }

  async function addSoal() {
    if (!detailView) return
    const no = (detailView.soal?.length || 0) + 1
    // Auto-fill audioUrl dari materi kalau kosong & materi punya audioUrl
    let finalAudioUrl = soalForm.audioUrl
    if (!finalAudioUrl && soalForm.materiId) {
      const mat = materiList.find(m => m.id === soalForm.materiId)
      if (mat?.audioUrl) finalAudioUrl = mat.audioUrl
    }
    const res = await fetch('/api/sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-soal',
        sesiId: detailView.id,
        no,
        jenis: soalForm.jenis,
        materiId: soalForm.materiId || null,
        pertanyaan: soalForm.pertanyaan || (soalForm.jenis === 'sambung' ? 'Pasangkan item kolom A dengan kolom B' : ''),
        pertanyaanArabic: soalForm.pertanyaanArabic || null,
        // FIX v3.2.1 #4: opsiJson sekarang array of objects {text, imageUrl} kalau ada gambar
        opsiJson: soalForm.jenis === 'mcq'
          ? (() => {
              const opsi = soalForm.opsi.filter(o => o.trim())
              const hasImages = soalForm.opsiImages.some(url => url.trim())
              if (hasImages) {
                return JSON.stringify(opsi.map((text, i) => ({
                  text,
                  imageUrl: soalForm.opsiImages[i]?.trim() || undefined,
                })))
              }
              return JSON.stringify(opsi) // backward compatible: string array
            })()
          : null,
        jawabanBenar: soalForm.jenis === 'mcq' ? (soalForm.opsi[soalForm.jawabanBenarIndex] || soalForm.jawabanBenar) || null : (soalForm.jawabanBenar || null),
        audioUrl: finalAudioUrl || null,
        imageUrl: soalForm.imageUrl || null,
        videoUrl: soalForm.videoUrl || null,
        embedUrl: soalForm.embedUrl || null,
        fase: soalForm.fase ? parseInt(soalForm.fase) : null,
        kategori: soalForm.kategori || null,
        bobot: soalForm.bobot,
        // FIX v3.2.1 #5: isAudio flag
        isAudio: soalForm.isAudio,
        // FIX v3.2.1 #3: pairsJson untuk sambung
        // FIX v3.2.8 #4: include per-side media (imageUrl, audioUrl)
        // FIX v3.3.0: include extras (distractor B tanpa pasangan A)
        pairsJson: soalForm.jenis === 'sambung'
          ? (() => {
              const validPairs = soalForm.pairs.filter(p => p.a.trim() && p.b.trim())
              const validExtras = (soalForm.extras || []).filter(e => (e.text || '').trim())
              if (validPairs.length > 0 || validExtras.length > 0) {
                return JSON.stringify({
                  pairs: validPairs.map(p => ({
                    a: { text: p.a, imageUrl: p.aImage?.trim() || undefined, audioUrl: p.aAudio?.trim() || undefined },
                    b: { text: p.b, imageUrl: p.bImage?.trim() || undefined, audioUrl: p.bAudio?.trim() || undefined },
                  })),
                  extras: validExtras.map(e => ({
                    text: e.text,
                    imageUrl: e.imageUrl?.trim() || undefined,
                    audioUrl: e.audioUrl?.trim() || undefined,
                  })),
                })
              }
              return null
            })()
          : null,
      }),
    })
    if (res.ok) {
      toast({ title: 'Soal ditambah' })
      // Reset form, keep jenis & skor
      setSoalForm({
        ...soalForm, pertanyaan: '', pertanyaanArabic: '', opsi: ['', '', '', ''], opsiImages: ['', '', '', ''],
        jawabanBenar: '', jawabanBenarIndex: 0, audioUrl: '', imageUrl: '', videoUrl: '', embedUrl: '', fase: '', kategori: '',
        isAudio: false, pairs: [{ a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }],
        extras: [{ text: '', imageUrl: '', audioUrl: '' }],
      })
      loadDetail()
    } else {
      const data = await res.json()
      toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
    }
  }

  async function copySoal(soal: any) {
    if (!detailView) return
    const no = (detailView.soal?.length || 0) + 1
    const res = await fetch('/api/sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-soal',
        sesiId: detailView.id,
        no,
        jenis: soal.jenis,
        materiId: soal.materiId,
        pertanyaan: soal.pertanyaan + ' (copy)',
        pertanyaanArabic: soal.pertanyaanArabic,
        opsiJson: soal.opsiJson,
        jawabanBenar: soal.jawabanBenar,

        audioUrl: soal.audioUrl,
        imageUrl: soal.imageUrl,
        videoUrl: soal.videoUrl,
        embedUrl: soal.embedUrl,
        fase: soal.fase || null,
        kategori: soal.kategori || null,
        bobot: soal.bobot,
        tipeSkor: soal.tipeSkor,
        hint: soal.hint,
      }),
    })
    if (res.ok) {
      toast({ title: 'Soal disalin' })
      loadDetail()
    }
  }

  async function hapusSoal(soalId: string) {
    if (!detailView) return
    if (!confirm('Hapus soal ini?')) return
    await fetch('/api/sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-soal', soalId }),
    })
    toast({ title: 'Soal dihapus' })
    loadDetail()
  }

  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<{ created: number; errors: string[] } | null>(null)

  async function generateFromScript() {
    if (!detailView) return
    if (!scriptText.trim()) {
      toast({ title: 'Script kosong', variant: 'destructive' })
      return
    }
    setGenerating(true)
    setGenerateResult(null)
    try {
      const res = await fetch('/api/sesi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-from-script', sesiId: detailView.id, script: scriptText }),
      })
      const data = await res.json()
      if (res.ok) {
        setGenerateResult({ created: data.created || 0, errors: data.errors || [] })
        toast({
          title: `✅ Berhasil generate ${data.created} soal`,
          description: data.errors?.length ? `${data.errors.length} baris gagal — lihat detail di bawah` : 'Semua soal berhasil dibuat',
          variant: data.errors?.length ? 'destructive' : 'default',
        })
        loadDetail()
      } else {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Network error', description: e.message, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // ===== EDIT SOAL =====
  const [editingSoal, setEditingSoal] = useState<any | null>(null)
  const [editSoalDialogOpen, setEditSoalDialogOpen] = useState(false)
  const [editSoalForm, setEditSoalForm] = useState<any>({})

  function openEditSoal(soal: any) {
    setEditingSoal(soal)
    // FIX v3.2.3: parse opsiJson — handle both string array (old) and object array (new with media)
    let opsiArr: string[] = ['', '', '', '']
    let opsiImagesArr: string[] = ['', '', '', '']
    if (soal.opsiJson) {
      try {
        const parsed = JSON.parse(soal.opsiJson)
        if (Array.isArray(parsed)) {
          opsiArr = parsed.map((o: any) => typeof o === 'string' ? o : (o.text || ''))
          opsiImagesArr = parsed.map((o: any) => typeof o === 'string' ? '' : (o.imageUrl || ''))
        }
      } catch {}
    }
    // FIX v3.2.8 #4: parse pairsJson dengan per-side media
    let pairsArr: { a: string; aImage: string; aAudio: string; b: string; bImage: string; bAudio: string }[] = [{ a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }]
    // FIX v3.3.0: parse extras (distractor B) dari pairsJson
    let extrasArr: { text: string; imageUrl: string; audioUrl: string }[] = [{ text: '', imageUrl: '', audioUrl: '' }]
    if (soal.pairsJson) {
      try {
        const parsed = JSON.parse(soal.pairsJson)
        if (parsed.pairs && Array.isArray(parsed.pairs)) {
          pairsArr = parsed.pairs.map((p: any) => ({
            a: p.a?.text || '',
            aImage: p.a?.imageUrl || '',
            aAudio: p.a?.audioUrl || '',
            b: p.b?.text || '',
            bImage: p.b?.imageUrl || '',
            bAudio: p.b?.audioUrl || '',
          }))
        }
        if (parsed.extras && Array.isArray(parsed.extras) && parsed.extras.length > 0) {
          extrasArr = parsed.extras.map((e: any) => ({
            text: e.text || '',
            imageUrl: e.imageUrl || '',
            audioUrl: e.audioUrl || '',
          }))
        }
      } catch {}
    }
    setEditSoalForm({
      soalId: soal.id,
      jenis: soal.jenis,
      materiId: soal.materiId || '',
      pertanyaan: soal.pertanyaan,
      pertanyaanArabic: soal.pertanyaanArabic || '',
      opsi: opsiArr,
      opsiImages: opsiImagesArr,
      jawabanBenar: soal.jawabanBenar || '',
      jawabanBenarIndex: soal.jenis === 'mcq' && soal.opsiJson && soal.jawabanBenar ? (() => { try { const o = JSON.parse(soal.opsiJson); return Math.max(0, o.indexOf(soal.jawabanBenar)); } catch { return 0; } })() : 0,
      audioUrl: soal.audioUrl || '',
      imageUrl: soal.imageUrl || '',
      videoUrl: soal.videoUrl || '',
      embedUrl: soal.embedUrl || '',
      fase: soal.fase ? String(soal.fase) : '',
      kategori: soal.kategori || '',
      bobot: soal.bobot,
      // FIX v3.2.3: tambah isAudio + pairs untuk edit dialog
      isAudio: soal.isAudio || false,
      pairs: pairsArr,
      // FIX v3.3.0: extras (distractor B) untuk edit dialog
      extras: extrasArr,
    })
    setEditSoalDialogOpen(true)
  }

  async function saveEditSoal() {
    if (!editingSoal) return
    const res = await fetch('/api/sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-soal',
        soalId: editingSoal.id,
        jenis: editSoalForm.jenis,
        materiId: editSoalForm.materiId || null,
        pertanyaan: editSoalForm.pertanyaan || (editSoalForm.jenis === 'sambung' ? 'Pasangkan item kolom A dengan kolom B' : ''),
        pertanyaanArabic: editSoalForm.pertanyaanArabic || null,
        // FIX v3.2.3 #4: opsiJson dengan media (sama seperti create form)
        opsiJson: editSoalForm.jenis === 'mcq'
          ? (() => {
              const opsi = (editSoalForm.opsi || []).filter((o: string) => o.trim())
              const hasImages = (editSoalForm.opsiImages || []).some((url: string) => url.trim())
              if (hasImages) {
                return JSON.stringify(opsi.map((text: string, i: number) => ({
                  text,
                  imageUrl: editSoalForm.opsiImages?.[i]?.trim() || undefined,
                })))
              }
              return JSON.stringify(opsi)
            })()
          : null,
        jawabanBenar: editSoalForm.jenis === 'mcq' ? (editSoalForm.opsi[editSoalForm.jawabanBenarIndex] || editSoalForm.jawabanBenar) || null : (editSoalForm.jawabanBenar || null),
        audioUrl: editSoalForm.audioUrl || null,
        imageUrl: editSoalForm.imageUrl || null,
        videoUrl: editSoalForm.videoUrl || null,
        embedUrl: editSoalForm.embedUrl || null,
        fase: editSoalForm.fase ? parseInt(editSoalForm.fase) : null,
        kategori: editSoalForm.kategori || null,
        bobot: editSoalForm.bobot,
        // FIX v3.2.3 #5: isAudio + pairsJson
        isAudio: editSoalForm.isAudio || false,
        // FIX v3.2.8 #4: include per-side media (imageUrl, audioUrl) untuk sambung
        // FIX v3.3.0: include extras (distractor B tanpa pasangan A)
        pairsJson: editSoalForm.jenis === 'sambung'
          ? (() => {
              const validPairs = (editSoalForm.pairs || []).filter((p: any) => (p.a || '').trim() && (p.b || '').trim())
              const validExtras = (editSoalForm.extras || []).filter((e: any) => (e.text || '').trim())
              if (validPairs.length > 0 || validExtras.length > 0) {
                return JSON.stringify({
                  pairs: validPairs.map((p: any) => ({
                    a: { text: p.a, imageUrl: p.aImage?.trim() || undefined, audioUrl: p.aAudio?.trim() || undefined },
                    b: { text: p.b, imageUrl: p.bImage?.trim() || undefined, audioUrl: p.bAudio?.trim() || undefined },
                  })),
                  extras: validExtras.map((e: any) => ({
                    text: e.text,
                    imageUrl: e.imageUrl?.trim() || undefined,
                    audioUrl: e.audioUrl?.trim() || undefined,
                  })),
                })
              }
              return null
            })()
          : null,
      }),
    })
    if (res.ok) {
      toast({ title: 'Soal diperbarui' })
      setEditSoalDialogOpen(false)
      loadDetail()
    } else {
      const data = await res.json()
      toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
    }
  }

  // ===== EXPORT SCRIPT =====
  function buildSoalScript(s: any): string {
    // FIX #7: Format baru (rich text friendly, gak pakai P:/AR:/J: prefix)
    // Format:
    // ## N. [jenis]
    // <pertanyaan bebas format, bisa multiline>
    //
    // jawaban: <jawaban benar>
    // alt: <alternatif1, alternatif2>
    // bobot: 1
    // audio: <url>
    // gambar: <url>
    // video: <url>
    // embed: <url>
    // fase: 1
    // kategori: Mufrodat
    let script = `## ${s.no}. [${s.jenis}]\n`
    // Pertanyaan (boleh HTML kalau dari RichTextEditor)
    script += `${s.pertanyaan || ''}\n`
    // Opsi MCQ (pakai markdown list dengan + untuk jawaban benar)
    if (s.jenis === 'mcq' && s.opsiJson) {
      try {
        const opsi: string[] = JSON.parse(s.opsiJson)
        opsi.forEach(o => {
          const isBenar = o === s.jawabanBenar
          script += `- ${isBenar ? '[+]' : ''} ${o}\n`
        })
      } catch {}
    }
    script += '\n'
    if (s.jawabanBenar && s.jenis !== 'mcq') script += `jawaban: ${s.jawabanBenar}\n`
    if (s.jawabanAlternatif) {
      try {
        const alts = JSON.parse(s.jawabanAlternatif)
        script += `alt: ${alts.join(', ')}\n`
      } catch {}
    }
    if (s.audioUrl) script += `audio: ${s.audioUrl}\n`
    if (s.imageUrl) script += `gambar: ${s.imageUrl}\n`
    if (s.videoUrl) script += `video: ${s.videoUrl}\n`
    if (s.embedUrl) script += `embed: ${s.embedUrl}\n`
    if (s.fase) script += `fase: ${s.fase}\n`
    if (s.kategori) script += `kategori: ${s.kategori}\n`
    if (s.bobot && s.bobot !== 1) script += `bobot: ${s.bobot}\n`
    return script
  }

  function exportSoalScript(s: any) {
    const script = buildSoalScript(s)
    navigator.clipboard.writeText(script).then(() => {
      toast({ title: 'Script soal disalin ke clipboard' })
    }).catch(() => {
      // Fallback: download as .txt
      const blob = new Blob([script], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `soal-${s.no}.txt`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function exportAllScript() {
    if (!detailView) return
    const scripts = detailView.soal.map((s: any) => buildSoalScript(s)).join('\n')
    const blob = new Blob([scripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `script-ujian-${detailView.nama.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: `Export ${detailView.soal.length} soal ke script` })
  }

  // ===== UJI COBA (sebelumnya: Preview) =====
  // FIX v3.2.9 #2: ganti simple preview jadi Uji Coba interaktif — admin bisa jawab soal
  //   seperti mahasiswa, nilai dihitung lokal, TIDAK disimpan ke database.
  const [previewMode, setPreviewMode] = useState(false)
  const [ujiCobaIdx, setUjiCobaIdx] = useState(0)
  const [ujiCobaJawaban, setUjiCobaJawaban] = useState<Record<string, string>>({})
  const [ujiCobaDone, setUjiCobaDone] = useState(false)
  const [ujiCobaHasil, setUjiCobaHasil] = useState<{ skorTotal: number; jumlahBenar: number; jumlahSoal: number; perSoal: { soalId: string; benar: boolean; skor: number; jawabanUser: string }[] } | null>(null)

  function resetUjiCoba() {
    setUjiCobaIdx(0)
    setUjiCobaJawaban({})
    setUjiCobaDone(false)
    setUjiCobaHasil(null)
  }

  function submitUjiCoba() {
    if (!detailView) return
    const soalList = detailView.soal || []
    let jumlahBenar = 0
    let totalBobot = 0
    let totalBenarBobot = 0
    const perSoal: { soalId: string; benar: boolean; skor: number; jawabanUser: string }[] = []

    soalList.forEach((s: any) => {
      const bobot = s.bobot || 1
      totalBobot += bobot
      const jawabanUser = ujiCobaJawaban[s.id] || ''
      let benar = false
      let skor = 0

      if (s.jenis === 'isian') {
        const jawabanBenar = (s.jawabanBenar || '').trim()
        const altArr: string[] = s.jawabanAlternatif ? (() => { try { return JSON.parse(s.jawabanAlternatif) } catch { return [] } })() : []
        const userAns = jawabanUser.trim()
        benar = userAns === jawabanBenar || altArr.some((a: string) => a.trim() === userAns)
        if (benar) { skor = bobot; jumlahBenar++ }
      } else if (s.jenis === 'mcq') {
        // MCQ: jawabanBenar adalah text dari opsi yang benar
        // opsiJson bisa array of string atau array of {text, imageUrl}
        let opsi: any[] = []
        try { opsi = JSON.parse(s.opsiJson || '[]') } catch {}
        const jawabanBenar = s.jawabanBenar || ''
        const userAns = jawabanUser
        // userAns adalah opsi text yang dipilih
        benar = userAns === jawabanBenar
        if (benar) { skor = bobot; jumlahBenar++ }
      } else if (s.jenis === 'sambung') {
        // Sambung: partial credit — correctPairs / totalPairs × bobot
        let pairsData: { pairs: { a: any; b: any }[]; extras: any[] } = { pairs: [], extras: [] }
        try { pairsData = JSON.parse(s.pairsJson || '{}') } catch {}
        const pairs = pairsData.pairs || []
        const userAns = (() => { try { return JSON.parse(jawabanUser || '{}') } catch { return {} } })()
        let correctPairs = 0
        pairs.forEach((p: any, idx: number) => {
          // userAns[idx] = bOriginalIdx yang dipilih user untuk A[idx]
          // B correct = idx (karena pairs[i].b.originalIdx = i dalam urutan pairs)
          if (Number(userAns[String(idx)]) === idx) correctPairs++
        })
        benar = correctPairs === pairs.length
        skor = pairs.length > 0 ? (correctPairs / pairs.length) * bobot : 0
        if (benar) jumlahBenar++
      }

      totalBenarBobot += skor
      perSoal.push({ soalId: s.id, benar, skor, jawabanUser })
    })

    const skorTotal = totalBobot > 0 ? (totalBenarBobot / totalBobot) * 100 : 0
    setUjiCobaHasil({ skorTotal, jumlahBenar, jumlahSoal: soalList.length, perSoal })
    setUjiCobaDone(true)
  }

  if (loading) return <Loading />

  if (detailView) {
    return (
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setDetailView(null)} className="mb-2">← Kembali ke daftar</Button>
          <PageHeader
            title={detailView.nama}
            description={`${detailView.level?.nama} · ${detailView.mode} · ${detailView.durasiMenit} menit · ${detailView.soal.length} soal`}
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportAllScript} disabled={detailView.soal.length === 0} className="rounded-xl">
                  <Download className="w-4 h-4 mr-1.5" /> Export Script
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPreviewMode(!previewMode); if (!previewMode) resetUjiCoba() }} className="rounded-xl">
                  <Play className="w-4 h-4 mr-1.5" /> {previewMode ? 'Keluar Uji Coba' : 'Uji Coba'}
                </Button>
              </div>
            }
          />
          {(detailView.acakUrutan || detailView.jumlahSoalPerMahasiswa) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {detailView.acakUrutan && (
                <Badge variant="purple"><Shuffle className="w-3 h-3 mr-1 inline" /> Urutan soal diacak per mahasiswa</Badge>
              )}
              {detailView.jumlahSoalPerMahasiswa && (
                <Badge variant="gold">Ambil {detailView.jumlahSoalPerMahasiswa} dari {detailView.soal.length} soal per mahasiswa</Badge>
              )}
            </div>
          )}
          {/* Schedule display */}
          {(detailView.jamMulai || detailView.jamSelesai || detailView.tanggalMulai) && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <Badge variant="info">
                📅 {new Date(detailView.tanggalMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Badge>
              {detailView.jamMulai && <Badge variant="default">⏰ {detailView.jamMulai} - {detailView.jamSelesai || '?'}</Badge>}
            </div>
          )}
        </div>

        {/* UJI COBA MODE — admin coba seperti mahasiswa, nilai tidak disimpan */}
        {/* FIX v3.2.9 #2: replace simple read-only preview dengan interactive try-out */}
        {previewMode && (
          <Card className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" /> Uji Coba Mode (sebagai mahasiswa)
              </CardTitle>
              <p className="text-xs text-gray-500">
                Coba kerjakan soal seperti mahasiswa. Jawaban benar disembunyikan sampai dikumpulkan.
                Nilai dihitung lokal — <strong>TIDAK disimpan ke database</strong>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {ujiCobaDone && ujiCobaHasil ? (
                // === HASIL UJI COBA ===
                <div className="space-y-4">
                  <div className="text-center py-6 bg-white rounded-xl border border-emerald-200">
                    <p className="text-sm text-gray-500 mb-2">Skor Uji Coba Anda:</p>
                    <p className={`text-6xl font-bold ${getGrade(ujiCobaHasil.skorTotal).color}`}>{ujiCobaHasil.skorTotal.toFixed(1)}%</p>
                    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full mt-3 ${getGrade(ujiCobaHasil.skorTotal).bgClass}`}>
                      <span className={`font-arabic text-2xl ${getGrade(ujiCobaHasil.skorTotal).color}`}>{getGrade(ujiCobaHasil.skorTotal).arabic}</span>
                      <span className={`text-sm font-semibold ${getGrade(ujiCobaHasil.skorTotal).color}`}>({getGrade(ujiCobaHasil.skorTotal).letter})</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Benar: {ujiCobaHasil.jumlahBenar}/{ujiCobaHasil.jumlahSoal} soal</p>
                  </div>

                  {/* Detail per soal */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Detail Jawaban:</p>
                    {detailView.soal.map((s: any, i: number) => {
                      const perSoal = ujiCobaHasil.perSoal.find(p => p.soalId === s.id)
                      const isBenar = perSoal?.benar
                      const userAns = perSoal?.jawabanUser || ''
                      return (
                        <div key={s.id} className={`p-3 rounded-xl border ${isBenar ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-700">#{i + 1}</span>
                            <Badge variant="info">{s.jenis}</Badge>
                            {isBenar ? (
                              <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Benar</span>
                            ) : (
                              <span className="text-rose-700 text-xs font-semibold">✗ Salah / Tidak terisi</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-1">Pertanyaan: {s.pertanyaan}</p>
                          <p className="text-xs text-gray-700">Jawaban Anda: <span className="font-mono">{userAns || '(kosong)'}</span></p>
                          <p className="text-xs text-emerald-700 mt-1">Jawaban benar: <span className="font-mono">{s.jawabanBenar}</span></p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => { resetUjiCoba() }} variant="outline" className="rounded-xl">
                      <Play className="w-4 h-4 mr-1.5" /> Uji Coba Lagi
                    </Button>
                    <Button onClick={() => { setPreviewMode(false); resetUjiCoba() }} variant="ghost" className="rounded-xl">
                      Keluar Uji Coba
                    </Button>
                  </div>
                </div>
              ) : (
                // === FORM UJI COBA INTERAKTIF ===
                <>
                  {/* Progress */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Soal {ujiCobaIdx + 1} dari {detailView.soal.length}</span>
                    <span>{Math.round(((ujiCobaIdx + 1) / detailView.soal.length) * 100)}% selesai</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${((ujiCobaIdx + 1) / detailView.soal.length) * 100}%` }} />
                  </div>

                  {/* Quick nav grid */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {detailView.soal.map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setUjiCobaIdx(i)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                          i === ujiCobaIdx ? 'bg-emerald-600 text-white' :
                          ujiCobaJawaban[detailView.soal[i].id] ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Current soal */}
                  {detailView.soal[ujiCobaIdx] && (() => {
                    const s = detailView.soal[ujiCobaIdx]
                    return (
                      <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-700">#{ujiCobaIdx + 1}</span>
                          <Badge variant="info">{s.jenis}</Badge>
                          <span className="text-xs text-gray-500">bobot {s.bobot}</span>
                        </div>
                        <p className="text-gray-800 font-medium">{s.pertanyaan}</p>
                        {s.pertanyaanArabic && (
                          <div className="bg-emerald-50 rounded-xl p-3 text-right">
                            <ArabicText size="lg" className="text-emerald-800">{s.pertanyaanArabic}</ArabicText>
                          </div>
                        )}
                        {s.imageUrl && (
                          <div className="aspect-square w-32 h-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                            <img src={s.imageUrl} alt="soal" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {s.audioUrl && <audio controls src={s.audioUrl} className="w-full h-9" preload="none" />}
                        {s.embedUrl && (
                          <iframe src={s.embedUrl} className="w-full h-48 rounded-lg border border-gray-200" />
                        )}

                        {/* === INPUT per jenis === */}
                        {s.jenis === 'isian' && (
                          <Input
                            value={ujiCobaJawaban[s.id] || ''}
                            onChange={(e) => setUjiCobaJawaban({ ...ujiCobaJawaban, [s.id]: e.target.value })}
                            dir="rtl"
                            className="font-arabic text-right text-xl rounded-xl"
                            placeholder="Tulis jawaban..."
                          />
                        )}

                        {s.jenis === 'mcq' && s.opsiJson && (() => {
                          let opsi: any[] = []
                          try { opsi = JSON.parse(s.opsiJson) } catch {}
                          return (
                            <RadioGroup
                              value={ujiCobaJawaban[s.id] || ''}
                              onValueChange={(v) => setUjiCobaJawaban({ ...ujiCobaJawaban, [s.id]: v })}
                              className="space-y-2"
                            >
                              {opsi.map((o: any, idx: number) => {
                                const opsiText = typeof o === 'string' ? o : o.text
                                const opsiImage = typeof o === 'string' ? null : o.imageUrl
                                const opsiAudio = typeof o === 'string' ? null : o.audioUrl
                                return (
                                  <div key={idx} className="flex items-start gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <RadioGroupItem value={opsiText} id={`uji-coba-${s.id}-${idx}`} className="mt-1" />
                                    <label htmlFor={`uji-coba-${s.id}-${idx}`} className="cursor-pointer flex-1">
                                      <ArabicText size="md" className="text-gray-800">{opsiText}</ArabicText>
                                      {opsiImage && (
                                        <div className="mt-2 aspect-square w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                                          <img src={opsiImage} alt="opsi" className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                      {opsiAudio && <audio controls src={opsiAudio} className="w-full h-9 mt-2" preload="none" />}
                                    </label>
                                  </div>
                                )
                              })}
                            </RadioGroup>
                          )
                        })()}

                        {s.jenis === 'sambung' && s.pairsJson && (
                          <SambungCableGame
                            pairsJson={s.pairsJson}
                            currentAnswer={ujiCobaJawaban[s.id] || '{}'}
                            onAnswerChange={(v) => setUjiCobaJawaban({ ...ujiCobaJawaban, [s.id]: v })}
                          />
                        )}

                        {/* Nav buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUjiCobaIdx(Math.max(0, ujiCobaIdx - 1))}
                            disabled={ujiCobaIdx === 0}
                            className="rounded-xl"
                          >
                            <ArrowLeft className="w-4 h-4 mr-1" /> Sebelumnya
                          </Button>
                          {ujiCobaIdx < detailView.soal.length - 1 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setUjiCobaIdx(ujiCobaIdx + 1)}
                              className="rounded-xl"
                            >
                              Berikutnya <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                if (confirm('Kumpulkan jawaban uji coba? Nilai tidak akan disimpan.')) submitUjiCoba()
                              }}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Kumpulkan Uji Coba
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm('Kumpulkan jawaban uji coba? Nilai tidak akan disimpan.')) submitUjiCoba()
                      }}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Kumpulkan Uji Coba
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="soal">
          <TabsList className="bg-gray-100 rounded-full p-1">
            <TabsTrigger value="soal" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Daftar Soal ({detailView.soal.length})</TabsTrigger>
            <TabsTrigger value="add" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Plus className="w-3 h-3 mr-1 inline" /> Tambah Manual
            </TabsTrigger>
            <TabsTrigger value="script" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileCode2 className="w-3 h-3 mr-1 inline" /> Script Generator
            </TabsTrigger>
            <TabsTrigger value="hasil" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Hasil ({detailView.hasil?.length || 0})</TabsTrigger>
            <TabsTrigger value="peserta" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Peserta</TabsTrigger>
          </TabsList>

          {/* Daftar Soal */}
          <TabsContent value="soal" className="space-y-3 mt-4">
            {detailView.soal.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-soft">
                <CardContent>
                  <EmptyState title="Belum ada soal" description="Tambah soal manual, copy dari soal lain, atau generate via script" />
                </CardContent>
              </Card>
            ) : (
              detailView.soal.map((s: any) => (
                <Card key={s.id} className="rounded-2xl border-0 shadow-soft hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-emerald-700">#{s.no}</span>
                          <Badge variant="info">{s.jenis}</Badge>
                          <Badge variant="default">{s.tipeSkor}</Badge>
                          <span className="text-xs text-gray-500">bobot {s.bobot}</span>
                          {s.fase && <Badge variant="purple">Fase {s.fase}</Badge>}
                          {s.kategori && <Badge variant="gold">{s.kategori}</Badge>}
                          {s.materi && <Badge variant="warning">{s.materi.jenis}</Badge>}
                        </div>
                        <p className="text-gray-800">{s.pertanyaan}</p>
                        {s.pertanyaanArabic && (
                          <div className="bg-emerald-50 rounded-xl p-3 text-right">
                            <ArabicText size="lg" className="text-emerald-800">{s.pertanyaanArabic}</ArabicText>
                          </div>
                        )}
                        {s.jenis === 'mcq' && s.opsiJson && (
                          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                            Opsi: {JSON.parse(s.opsiJson).join(' | ')}
                          </div>
                        )}
                        {s.jawabanBenar && (
                          <p className="text-xs text-emerald-700 font-medium">Jawaban benar: {s.jawabanBenar}</p>
                        )}
                        {s.audioUrl && (
                          <div className="bg-emerald-50 rounded-lg p-2 space-y-1">
                            <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">Audio (admin)</p>
                            <audio controls src={s.audioUrl} className="w-full h-8" preload="none" />
                          </div>
                        )}
                        {s.hint && <p className="text-xs text-gray-500">Hint: {s.hint}</p>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditSoal(s)} title="Edit soal" className="rounded-lg h-8 w-8 p-0">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copySoal(s)} title="Copy soal" className="rounded-lg h-8 w-8 p-0">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => exportSoalScript(s)} title="Export script soal ini" className="rounded-lg h-8 w-8 p-0 text-emerald-600">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 rounded-lg h-8 w-8 p-0" onClick={() => hapusSoal(s.id)} title="Hapus soal">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tambah Manual */}
          <TabsContent value="add" className="space-y-4 mt-4">
            <Card className="rounded-2xl border-0 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Tambah Soal Manual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Jenis Soal</Label>
                    <Select value={soalForm.jenis} onValueChange={(v) => setSoalForm({ ...soalForm, jenis: v as any })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="isian">Isian / Hafalan</SelectItem>
                        <SelectItem value="mcq">Pilihan Ganda (MCQ)</SelectItem>
                        {/* FIX v3.2.1 #3: jenis sambung untuk matching pairs */}
                        <SelectItem value="sambung">Sambung / Pasangkan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Materi (opsional)</Label>
                    <Select value={soalForm.materiId || 'none'} onValueChange={(v) => setSoalForm({ ...soalForm, materiId: v === 'none' ? '' : v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tanpa materi" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa materi</SelectItem>
                        {materiList.map(m => <SelectItem key={m.id} value={m.id}>{m.arabic} — {m.arti}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pertanyaan</Label>
                  {/* FIX v2.9.9: hapus RichTextEditor (user mau hapus fitur richtext di pembuatan soal).
                      Pakai Textarea biasa dengan font Arabic-friendly (font-arabic = Amiri).
                      Amiri merender Latin chars juga dengan baik (serif, mirip Times).
                      Satukan pertanyaan Indonesia + Arabic jadi 1 field — hapus field
                      "Pertanyaan versi Arabic" yang terpisah. Admin bisa ketik Arabic atau
                      Indonesia di textarea ini, keduanya akan tampil dengan font Amiri. */}
                  <Textarea
                    value={soalForm.pertanyaan}
                    onChange={(e) => setSoalForm({ ...soalForm, pertanyaan: e.target.value })}
                    rows={4}
                    placeholder="Tuliskan pertanyaan di sini... (Arab atau Indonesia)"
                    className="font-arabic text-lg rounded-xl leading-relaxed"
                  />
                  <p className="text-[10px] text-gray-500">
                    Tip: Bisa tulis Arab (RTL akan otomatis) atau Indonesia. Gunakan field media di bawah untuk gambar/audio/video.
                  </p>
                </div>

                {soalForm.jenis === 'mcq' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Opsi Jawaban (pilih jawaban benar dengan radio)</Label>
                    {soalForm.opsi.map((o, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="jawabanBenarMCQ"
                            checked={soalForm.jawabanBenarIndex === i}
                            onChange={() => setSoalForm({ ...soalForm, jawabanBenarIndex: i, jawabanBenar: o })}
                            className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                          />
                          <Input
                            value={o}
                            onChange={(e) => {
                              const newOpsi = [...soalForm.opsi]
                              newOpsi[i] = e.target.value
                              const newJawaban = soalForm.jawabanBenarIndex === i ? e.target.value : soalForm.jawabanBenar
                              setSoalForm({ ...soalForm, opsi: newOpsi, jawabanBenar: newJawaban })
                            }}
                            placeholder={`Opsi ${i + 1}`}
                            className={`rounded-xl flex-1 ${soalForm.jawabanBenarIndex === i ? 'border-emerald-400 bg-emerald-50/30' : ''}`}
                          />
                          {soalForm.opsi.length > 2 && (
                            <button
                              onClick={() => {
                                const newOpsi = soalForm.opsi.filter((_, idx) => idx !== i)
                                const newImages = (soalForm.opsiImages || []).filter((_, idx) => idx !== i)
                                const newIndex = soalForm.jawabanBenarIndex >= i ? Math.max(0, soalForm.jawabanBenarIndex - 1) : soalForm.jawabanBenarIndex
                                setSoalForm({ ...soalForm, opsi: newOpsi, opsiImages: newImages, jawabanBenarIndex: newIndex, jawabanBenar: newOpsi[newIndex] || '' })
                              }}
                              className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {/* FIX v3.2.1 #4: gambar URL per opsi MCQ */}
                        <Input
                          value={(soalForm.opsiImages || [])[i] || ''}
                          onChange={(e) => {
                            const newImages = [...(soalForm.opsiImages || [])]
                            while (newImages.length <= i) newImages.push('')
                            newImages[i] = e.target.value
                            setSoalForm({ ...soalForm, opsiImages: newImages })
                          }}
                          placeholder="URL gambar opsi (opsional)"
                          className="rounded-xl text-xs h-8 ml-6"
                        />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setSoalForm({ ...soalForm, opsi: [...soalForm.opsi, ''], opsiImages: [...(soalForm.opsiImages || []), ''] })} className="rounded-full">+ Tambah opsi</Button>
                  </div>
                )}

                {/* FIX v3.2.1 #3: sambung pairs input — muncul kalau jenis = 'sambung' */}
                {/* FIX v3.2.8 #4: per-pair media (gambar/audio) untuk A dan B */}
                {soalForm.jenis === 'sambung' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pasangan Sambung (A ↔ B)</Label>
                    <p className="text-[10px] text-gray-500">Isi pasangan: kolom A (Arabic) ↔ kolom B (arti/pasangan). Urutan B akan diacak otomatis saat ujian. Gambar/audio opsional per sisi.</p>
                    {soalForm.pairs.map((pair, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-2.5 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <Input
                            value={pair.a}
                            onChange={(e) => {
                              const newPairs = [...soalForm.pairs]
                              newPairs[i] = { ...pair, a: e.target.value }
                              setSoalForm({ ...soalForm, pairs: newPairs })
                            }}
                            dir="rtl"
                            className="font-arabic text-right rounded-xl flex-1"
                            placeholder="أَبٌ"
                          />
                          <span className="text-gray-400 text-xs">↔</span>
                          <Input
                            value={pair.b}
                            onChange={(e) => {
                              const newPairs = [...soalForm.pairs]
                              newPairs[i] = { ...pair, b: e.target.value }
                              setSoalForm({ ...soalForm, pairs: newPairs })
                            }}
                            className="rounded-xl flex-1"
                            placeholder="ayah"
                          />
                          {soalForm.pairs.length > 1 && (
                            <button
                              onClick={() => setSoalForm({ ...soalForm, pairs: soalForm.pairs.filter((_, idx) => idx !== i) })}
                              className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {/* Per-pair media — gambar/audio for A and B (optional) */}
                        <div className="grid grid-cols-2 gap-2 pl-2 text-[10px] text-gray-500">
                          <span className="text-right">Media A</span>
                          <span>Media B</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Input
                              value={pair.aImage || ''}
                              onChange={(e) => {
                                const newPairs = [...soalForm.pairs]
                                newPairs[i] = { ...pair, aImage: e.target.value }
                                setSoalForm({ ...soalForm, pairs: newPairs })
                              }}
                              placeholder="URL gambar A (opsional)"
                              className="rounded-lg text-[11px] h-7"
                            />
                            <Input
                              value={pair.aAudio || ''}
                              onChange={(e) => {
                                const newPairs = [...soalForm.pairs]
                                newPairs[i] = { ...pair, aAudio: e.target.value }
                                setSoalForm({ ...soalForm, pairs: newPairs })
                              }}
                              placeholder="URL audio A (opsional)"
                              className="rounded-lg text-[11px] h-7"
                            />
                          </div>
                          <div className="space-y-1">
                            <Input
                              value={pair.bImage || ''}
                              onChange={(e) => {
                                const newPairs = [...soalForm.pairs]
                                newPairs[i] = { ...pair, bImage: e.target.value }
                                setSoalForm({ ...soalForm, pairs: newPairs })
                              }}
                              placeholder="URL gambar B (opsional)"
                              className="rounded-lg text-[11px] h-7"
                            />
                            <Input
                              value={pair.bAudio || ''}
                              onChange={(e) => {
                                const newPairs = [...soalForm.pairs]
                                newPairs[i] = { ...pair, bAudio: e.target.value }
                                setSoalForm({ ...soalForm, pairs: newPairs })
                              }}
                              placeholder="URL audio B (opsional)"
                              className="rounded-lg text-[11px] h-7"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setSoalForm({ ...soalForm, pairs: [...soalForm.pairs, { a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }] })} className="rounded-full">+ Tambah pasangan</Button>
                  </div>
                )}

                {/* FIX v3.3.0: Distractor B section (B tanpa pasangan A) — untuk soal sambung */}
                {soalForm.jenis === 'sambung' && (
                  <div className="space-y-2 border-t border-dashed border-amber-300 pt-3 mt-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-amber-700">Distractor B (opsional, tanpa pasangan A)</Label>
                    <p className="text-[10px] text-amber-600">B item yang tidak punya pasangan A — muncul di kolom B saat ujian sebagai jawaban palsu (distractor). Bisa ada beberapa.</p>
                    {(soalForm.extras || [{ text: '', imageUrl: '', audioUrl: '' }]).map((ex: any, i: number) => (
                      <div key={i} className="border border-amber-200 rounded-xl p-2.5 space-y-2 bg-amber-50/30">
                        <div className="flex items-center gap-2">
                          <Input
                            value={ex.text || ''}
                            onChange={(e) => {
                              const newExtras = [...(soalForm.extras || [])]
                              while (newExtras.length <= i) newExtras.push({ text: '', imageUrl: '', audioUrl: '' })
                              newExtras[i] = { ...ex, text: e.target.value }
                              setSoalForm({ ...soalForm, extras: newExtras })
                            }}
                            className="rounded-xl flex-1"
                            placeholder="Distractor (B tanpa pasangan A)"
                          />
                          {(soalForm.extras || []).length > 1 && (
                            <button
                              onClick={() => setSoalForm({ ...soalForm, extras: (soalForm.extras || []).filter((_: any, idx: number) => idx !== i) })}
                              className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={ex.imageUrl || ''}
                            onChange={(e) => {
                              const newExtras = [...(soalForm.extras || [])]
                              while (newExtras.length <= i) newExtras.push({ text: '', imageUrl: '', audioUrl: '' })
                              newExtras[i] = { ...ex, imageUrl: e.target.value }
                              setSoalForm({ ...soalForm, extras: newExtras })
                            }}
                            placeholder="URL gambar (opsional)"
                            className="rounded-lg text-[11px] h-7"
                          />
                          <Input
                            value={ex.audioUrl || ''}
                            onChange={(e) => {
                              const newExtras = [...(soalForm.extras || [])]
                              while (newExtras.length <= i) newExtras.push({ text: '', imageUrl: '', audioUrl: '' })
                              newExtras[i] = { ...ex, audioUrl: e.target.value }
                              setSoalForm({ ...soalForm, extras: newExtras })
                            }}
                            placeholder="URL audio (opsional)"
                            className="rounded-lg text-[11px] h-7"
                          />
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setSoalForm({ ...soalForm, extras: [...(soalForm.extras || []), { text: '', imageUrl: '', audioUrl: '' }] })} className="rounded-full border-amber-300 text-amber-700 hover:bg-amber-50">+ Tambah distractor</Button>
                  </div>
                )}

                {/* Jawaban Benar untuk isian (text input, bukan radio) */}
                {soalForm.jenis === 'isian' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Jawaban Benar</Label>
                    <Input value={soalForm.jawabanBenar} onChange={(e) => setSoalForm({ ...soalForm, jawabanBenar: e.target.value })} dir="rtl" className="font-arabic text-right text-xl rounded-xl" placeholder="أَبٌ" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Bobot</Label>
                    <Input type="number" step="0.5" value={soalForm.bobot} onChange={(e) => setSoalForm({ ...soalForm, bobot: parseFloat(e.target.value) || 1 })} className="rounded-xl" />
                  </div>
                </div>

                {/* Fase & Kategori (opsional) */}
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-violet-800">Fase & Kategori Soal (opsional)</p>
                  <p className="text-xs text-gray-600">Bagi soal ke fase (1, 2, 3...) — soal diacak per fase. Kategori untuk evaluasi per kelompok soal.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Fase (1, 2, 3...)</Label>
                      <Input
                        type="number"
                        value={soalForm.fase}
                        onChange={(e) => setSoalForm({ ...soalForm, fase: e.target.value })}
                        placeholder="Kosongkan jika tanpa fase"
                        min="1"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Kategori Soal</Label>
                      <Input
                        value={soalForm.kategori}
                        onChange={(e) => setSoalForm({ ...soalForm, kategori: e.target.value })}
                        placeholder="Mis. Mufrodat, Tarkib, Qira'ah..."
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Media fields — tampil untuk SEMUA jenis soal (gambar/embed/audio/video) */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Media Soal (opsional)
                  </p>
                  <p className="text-xs text-gray-600">
                    Upload file langsung atau paste URL eksternal. Video YouTube bisa di-paste URL-nya.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <FileUpload label="Gambar" accept="image/*" value={soalForm.imageUrl} onChange={(v) => setSoalForm({ ...soalForm, imageUrl: v })} preview="image" />
                    <FileUpload label="Video" accept="video/*" value={soalForm.videoUrl} onChange={(v) => setSoalForm({ ...soalForm, videoUrl: v })} preview="video" />
                    <FileUpload label="Audio (mp3)" accept="audio/*" value={soalForm.audioUrl} onChange={(v) => setSoalForm({ ...soalForm, audioUrl: v })} preview="audio" />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Embed URL (iframe)
                      </Label>
                      <Input
                        value={soalForm.embedUrl}
                        onChange={(e) => setSoalForm({ ...soalForm, embedUrl: e.target.value })}
                        placeholder="https://... (untuk embed di soal)"
                        className="rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  {/* Preview media yang sudah diisi */}
                  {(soalForm.imageUrl || soalForm.videoUrl || soalForm.audioUrl) && (
                    <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                      <p className="text-xs font-semibold text-gray-600">Preview:</p>
                      {/* FIX v3.0.5: image preview square 1:1 */}
                      {soalForm.imageUrl && (
                        <div className="aspect-square w-32 h-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                          <img src={soalForm.imageUrl} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      {soalForm.videoUrl && (
                        <p className="text-xs text-gray-600">📹 Video: <a href={soalForm.videoUrl} target="_blank" className="text-blue-600 hover:underline">{soalForm.videoUrl}</a></p>
                      )}
                      {soalForm.audioUrl && (
                        <audio controls src={soalForm.audioUrl} className="w-full h-9" preload="none" />
                      )}
                    </div>
                  )}
                </div>

                {/* FIX v3.2.1 #5: isAudio toggle — kalau true, soal pakai TTS Arabic (Web Speech API) */}
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Switch
                    checked={soalForm.isAudio}
                    onCheckedChange={(v) => setSoalForm({ ...soalForm, isAudio: v })}
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">🎧 Audio TTS (Text-to-Speech)</p>
                    <p className="text-xs text-amber-600">
                      Kalau aktif: mahasiswa dengar lafaz Arabic via TTS browser (max 2x play, anti-cheat).
                      Wajib isi field "Pertanyaan versi Arabic" di atas.
                    </p>
                  </div>
                </div>

                <Button onClick={addSoal} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-1" /> Tambah Soal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Script Generator */}
          <TabsContent value="script" className="space-y-4 mt-4">
            <Card className="rounded-2xl border-0 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Script Generator
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">Tulis soal dengan format custom, sistem akan parse jadi soal otomatis</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-2">
                  <p className="font-semibold text-gray-700">Format Script Baru (v3.0.7 — opsi media, isAudio, sambung):</p>
                  <pre className="text-xs whitespace-pre-wrap">{`## 1. [isian]                  ← jenis: isian | mcq | sambung
Tuliskan bahasa Arab: ayah     ← pertanyaan (boleh multiline)

ar: أَبٌ                  ← (opsional) pertanyaan versi Arabic (tampil terpisah)
jawaban: أَبٌ                  ← jawaban benar (untuk isian)
alt: abun, abu                ← (opsional) alternatif jawaban
audio: https://...mp3         ← (opsional) URL audio (untuk pertanyaan)
gambar: https://...jpg        ← (opsional) URL gambar (untuk pertanyaan)
isAudio: true                 ← (opsional v3.0.7 #6) flag — soal pakai TTS Arabic
fase: 1, kategori: Mufrodat, bobot: 1  ← (opsional)

## 2. [mcq]                   ← MCQ: opsi pakai markdown list, [+]=jawaban benar
Apa arti kata berikut? مُحَاضِرٌ

- [+] Dosen                   ← [+]=jawaban benar
  gambar: https://...jpg      ← (opsional v3.0.7 #5) gambar per opsi
  audio: https://...mp3       ← (opsional v3.0.7 #5) audio per opsi
- Guru SD
  gambar: https://...jpg
- Mahasiswa
- Kepala Sekolah

## 3. [sambung]               ← (v3.0.7 #7) NEW jenis — matching pairs
Pasangkan kata dengan artinya

(1a) هذا                      ← format (Na) untuk kolom A, (Nb) untuk kolom B
(1b) كتاب                     ← N = nomor pair (harus sama untuk a & b)
(2a) هذه                      ← A dan B bisa ada gambar/audio (langsung di bawah pair)
(2b) مكنسة
  gambar: https://...jpg
(3a) باب
(3b) pintu

---                           ← pisah antar soal dengan ---

(extra) قلم              ← (opsional) jawaban palsu B tanpa pasangan A (distractor)
(extra) مدرسة            ← boleh ada beberapa extra

Jenis tersedia: isian, mcq, sambung

Scoring sambung: partial credit per pasangan benar.
Misal 5 pasangan, 4 benar → skor = 4/5 = 80% (bukan 0).`}</pre>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Script Soal</Label>
                  <Textarea
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    rows={16}
                    className="font-mono text-sm rounded-xl"
                    placeholder={`## 1. [isian]
Tuliskan bahasa Arab: ayah

jawaban: أَبٌ
alt: abun, abu

---

## 2. [mcq]
Apa arti dari kata berikut?

- [+] Dosen
- Guru SD
- Mahasiswa`}
                  />
                </div>

                <Button onClick={generateFromScript} disabled={generating} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Sedang generate...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" /> Generate Soal dari Script
                    </>
                  )}
                </Button>
                {generateResult && (
                  <div className={`p-3 rounded-xl border ${generateResult.errors.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className={`w-4 h-4 ${generateResult.errors.length ? 'text-amber-600' : 'text-emerald-600'}`} />
                      <span className={generateResult.errors.length ? 'text-amber-800' : 'text-emerald-800'}>
                        {generateResult.created} soal berhasil dibuat
                      </span>
                    </div>
                    {generateResult.errors.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700">
                        <p className="font-semibold mb-1">⚠️ {generateResult.errors.length} baris gagal:</p>
                        <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto font-mono">
                          {generateResult.errors.slice(0, 10).map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                          {generateResult.errors.length > 10 && (
                            <li className="italic">...{generateResult.errors.length - 10} error lainnya</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hasil */}
          <TabsContent value="hasil" className="space-y-3 mt-4">
            {/* FIX #5: Button copy nama mahasiswa yang belum kerja ujian ini */}
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch(`/api/sesi?action=belum-kerja&id=${detailView.id}`).then(r => r.json())
                    const belum = r.data || []
                    if (belum.length === 0) {
                      toast({ title: '✅ Semua mahasiswa sudah mengerjakan ujian ini' })
                      return
                    }
                    // Format: "Nama1 (Kamar A1), Nama2 (Kamar A2), ..."
                    const text = belum.map((m: any) => `${m.nama} (${m.kamar?.nama || '-'})`).join(', ')
                    navigator.clipboard?.writeText(text).then(() => {
                      toast({ title: `✅ ${belum.length} nama disalin`, description: 'Paste ke WhatsApp/Telegram untuk ingatkan' })
                    }).catch(() => {
                      // Fallback: download as .txt
                      const blob = new Blob([text], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `belum-kerja-${detailView.nama.replace(/\s+/g, '-')}.txt`
                      a.click()
                      URL.revokeObjectURL(url)
                      toast({ title: `✅ ${belum.length} nama di-download sebagai .txt` })
                    })
                  } catch (e: any) {
                    toast({ title: 'Gagal fetch data', description: e.message, variant: 'destructive' })
                  }
                }}
                className="rounded-xl bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Salin Nama Belum Kerja
              </Button>
              <span className="text-xs text-gray-500">
                Salin list mahasiswa yang belum mengerjakan ujian ini ke clipboard
              </span>
            </div>
            {(!detailView.hasil || detailView.hasil.length === 0) ? (
              <Card className="rounded-2xl border-0 shadow-soft"><CardContent><EmptyState title="Belum ada hasil tes" /></CardContent></Card>
            ) : (
              <Card className="rounded-2xl border-0 shadow-soft">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4">Mahasiswa</th>
                        <th className="text-left py-3 px-4">Kamar</th>
                        <th className="text-left py-3 px-4">Status</th>
                        <th className="text-left py-3 px-4">Skor</th>
                        <th className="text-left py-3 px-4">Benar/Total</th>
                        <th className="text-left py-3 px-4">Selesai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailView.hasil.map((h: any) => (
                        <tr key={h.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium">{h.mahasiswa?.nama}</td>
                          <td className="py-2 px-4">{h.mahasiswa?.kamar?.nama}</td>
                          <td className="py-2 px-4"><Badge variant={h.status === 'graded' ? 'success' : h.status === 'submitted' ? 'info' : 'warning'}>{h.status}</Badge></td>
                          <td className="py-2 px-4 font-bold">{h.skorTotal?.toFixed(1)}%</td>
                          <td className="py-2 px-4">{h.jumlahBenar}/{h.jumlahSoal}</td>
                          <td className="py-2 px-4 text-gray-500 text-xs">{h.selesai ? new Date(h.selesai).toLocaleString('id-ID') : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab Peserta */}
          <TabsContent value="peserta" className="space-y-4 mt-4">
            <PesertaTab sesi={detailView} onSaved={loadDetail} />
          </TabsContent>
        </Tabs>
      {/* Dialog Edit Soal — DIPINDAH ke sini (dalam detail view return) agar tombol Edit berfungsi */}
      {/* FIX #3: layout flex col + sticky footer supaya tombol "Simpan Perubahan" selalu terlihat */}
      <Dialog open={editSoalDialogOpen} onOpenChange={setEditSoalDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle>Edit Soal #{editingSoal?.no}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Jenis</Label>
                <Select value={editSoalForm.jenis} onValueChange={(v) => setEditSoalForm({ ...editSoalForm, jenis: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="isian">Isian / Hafalan</SelectItem>
                    <SelectItem value="mcq">Pilihan Ganda (MCQ)</SelectItem>
                    {/* FIX v3.2.1 #3: jenis sambung */}
                    <SelectItem value="sambung">Sambung / Pasangkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Materi (opsional)</Label>
                <Select value={editSoalForm.materiId || 'none'} onValueChange={(v) => setEditSoalForm({ ...editSoalForm, materiId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tanpa materi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa materi</SelectItem>
                    {materiList.map(m => <SelectItem key={m.id} value={m.id}>{m.arabic} — {m.arti}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pertanyaan</Label>
              {/* FIX v2.9.9: hapus RichTextEditor + satukan pertanyaan. Pakai Textarea dengan font Arabic. */}
              <Textarea
                value={editSoalForm.pertanyaan}
                onChange={(e) => setEditSoalForm({ ...editSoalForm, pertanyaan: e.target.value })}
                rows={4}
                placeholder="Tuliskan pertanyaan... (Arab atau Indonesia)"
                className="font-arabic text-lg rounded-xl leading-relaxed"
              />
              <p className="text-[10px] text-gray-500">Tip: Bisa tulis Arab (RTL otomatis) atau Indonesia.</p>
            </div>
            {/* FIX v3.0.6 #4: tambah kembali field "Pertanyaan versi Arabic" di dialog edit soal.
                Sebelumnya dihapus di v2.9.9 (satukan pertanyaan), tapi user mau biarin aja —
                script parser masih dukung `ar:` field, jadi edit dialog juga harus bisa edit. */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Pertanyaan versi Arabic (opsional — tampil terpisah di atas pertanyaan Indo)
              </Label>
              <Input
                value={editSoalForm.pertanyaanArabic || ''}
                onChange={(e) => setEditSoalForm({ ...editSoalForm, pertanyaanArabic: e.target.value })}
                dir="rtl"
                className="font-arabic text-right text-xl rounded-xl"
                placeholder="مَا هَذَا؟"
              />
            </div>
            {editSoalForm.jenis === 'mcq' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Opsi (pilih jawaban benar dengan radio)</Label>
                {(editSoalForm.opsi || []).map((o: string, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="editJawabanBenarMCQ" checked={editSoalForm.jawabanBenarIndex === i}
                        onChange={() => setEditSoalForm({ ...editSoalForm, jawabanBenarIndex: i, jawabanBenar: o })}
                        className="w-4 h-4 accent-emerald-600 flex-shrink-0" />
                      <Input value={o}
                        onChange={(e) => { const n = [...editSoalForm.opsi]; n[i] = e.target.value; setEditSoalForm({ ...editSoalForm, opsi: n, jawabanBenar: editSoalForm.jawabanBenarIndex === i ? e.target.value : editSoalForm.jawabanBenar }) }}
                        placeholder={`Opsi ${i + 1}`}
                        className={`rounded-xl flex-1 ${editSoalForm.jawabanBenarIndex === i ? 'border-emerald-400 bg-emerald-50/30' : ''}`} />
                      {(editSoalForm.opsi || []).length > 2 && (
                        <button onClick={() => { const n = (editSoalForm.opsi || []).filter((_: string, idx: number) => idx !== i); const ni = (editSoalForm.opsiImages || []).filter((_: string, idx: number) => idx !== i); const idx = editSoalForm.jawabanBenarIndex >= i ? Math.max(0, editSoalForm.jawabanBenarIndex - 1) : editSoalForm.jawabanBenarIndex; setEditSoalForm({ ...editSoalForm, opsi: n, opsiImages: ni, jawabanBenarIndex: idx, jawabanBenar: n[idx] || '' }) }}
                          className="text-rose-500 hover:text-rose-700 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    {/* FIX v3.2.3 #4: gambar URL per opsi MCQ di edit dialog */}
                    <Input value={(editSoalForm.opsiImages || [])[i] || ''}
                      onChange={(e) => { const ni = [...(editSoalForm.opsiImages || [])]; while (ni.length <= i) ni.push(''); ni[i] = e.target.value; setEditSoalForm({ ...editSoalForm, opsiImages: ni }) }}
                      placeholder="URL gambar opsi (opsional)" className="rounded-xl text-xs h-8 ml-6" />
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setEditSoalForm({ ...editSoalForm, opsi: [...(editSoalForm.opsi || []), ''], opsiImages: [...(editSoalForm.opsiImages || []), ''] })} className="rounded-full">+ Tambah opsi</Button>
              </div>
            )}
            {/* FIX v3.2.3 #3: sambung pairs di edit dialog */}
            {/* FIX v3.2.8 #4: sambung pairs di edit dialog — per-pair media (gambar/audio) untuk A & B */}
            {editSoalForm.jenis === 'sambung' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pasangan Sambung (A ↔ B)</Label>
                <p className="text-[10px] text-gray-500">Isi pasangan: A (Arabic) ↔ B (arti). Urutan B diacak saat ujian. Gambar/audio opsional per sisi.</p>
                {(editSoalForm.pairs || [{ a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }]).map((pair: any, i: number) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-2.5 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Input value={pair.a || ''} onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, a: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }} dir="rtl" className="font-arabic text-right rounded-xl flex-1" placeholder="أَبٌ" />
                      <span className="text-gray-400 text-xs">↔</span>
                      <Input value={pair.b || ''} onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, b: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }} className="rounded-xl flex-1" placeholder="ayah" />
                      {(editSoalForm.pairs || []).length > 1 && (
                        <button onClick={() => setEditSoalForm({ ...editSoalForm, pairs: (editSoalForm.pairs || []).filter((_: any, idx: number) => idx !== i) })} className="text-rose-500 hover:text-rose-700 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    {/* Per-pair media — gambar/audio for A and B (optional) */}
                    <div className="grid grid-cols-2 gap-2 pl-2 text-[10px] text-gray-500">
                      <span className="text-right">Media A</span>
                      <span>Media B</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Input
                          value={pair.aImage || ''}
                          onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, aImage: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }}
                          placeholder="URL gambar A (opsional)"
                          className="rounded-lg text-[11px] h-7"
                        />
                        <Input
                          value={pair.aAudio || ''}
                          onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, aAudio: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }}
                          placeholder="URL audio A (opsional)"
                          className="rounded-lg text-[11px] h-7"
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          value={pair.bImage || ''}
                          onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, bImage: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }}
                          placeholder="URL gambar B (opsional)"
                          className="rounded-lg text-[11px] h-7"
                        />
                        <Input
                          value={pair.bAudio || ''}
                          onChange={(e) => { const n = [...(editSoalForm.pairs || [])]; n[i] = { ...pair, bAudio: e.target.value }; setEditSoalForm({ ...editSoalForm, pairs: n }) }}
                          placeholder="URL audio B (opsional)"
                          className="rounded-lg text-[11px] h-7"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setEditSoalForm({ ...editSoalForm, pairs: [...(editSoalForm.pairs || []), { a: '', aImage: '', aAudio: '', b: '', bImage: '', bAudio: '' }] })} className="rounded-full">+ Tambah pasangan</Button>
              </div>
            )}
            {/* FIX v3.3.0: Distractor B section (B tanpa pasangan A) — untuk edit soal sambung */}
            {editSoalForm.jenis === 'sambung' && (
              <div className="space-y-2 border-t border-dashed border-amber-300 pt-3 mt-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-amber-700">Distractor B (opsional, tanpa pasangan A)</Label>
                <p className="text-[10px] text-amber-600">B item yang tidak punya pasangan A — muncul di kolom B saat ujian sebagai jawaban palsu (distractor). Bisa ada beberapa.</p>
                {(editSoalForm.extras || [{ text: '', imageUrl: '', audioUrl: '' }]).map((ex: any, i: number) => (
                  <div key={i} className="border border-amber-200 rounded-xl p-2.5 space-y-2 bg-amber-50/30">
                    <div className="flex items-center gap-2">
                      <Input
                        value={ex.text || ''}
                        onChange={(e) => { const n = [...(editSoalForm.extras || [])]; while (n.length <= i) n.push({ text: '', imageUrl: '', audioUrl: '' }); n[i] = { ...ex, text: e.target.value }; setEditSoalForm({ ...editSoalForm, extras: n }) }}
                        className="rounded-xl flex-1"
                        placeholder="Distractor (B tanpa pasangan A)"
                      />
                      {(editSoalForm.extras || []).length > 1 && (
                        <button onClick={() => setEditSoalForm({ ...editSoalForm, extras: (editSoalForm.extras || []).filter((_: any, idx: number) => idx !== i) })} className="text-rose-500 hover:text-rose-700 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={ex.imageUrl || ''}
                        onChange={(e) => { const n = [...(editSoalForm.extras || [])]; while (n.length <= i) n.push({ text: '', imageUrl: '', audioUrl: '' }); n[i] = { ...ex, imageUrl: e.target.value }; setEditSoalForm({ ...editSoalForm, extras: n }) }}
                        placeholder="URL gambar (opsional)"
                        className="rounded-lg text-[11px] h-7"
                      />
                      <Input
                        value={ex.audioUrl || ''}
                        onChange={(e) => { const n = [...(editSoalForm.extras || [])]; while (n.length <= i) n.push({ text: '', imageUrl: '', audioUrl: '' }); n[i] = { ...ex, audioUrl: e.target.value }; setEditSoalForm({ ...editSoalForm, extras: n }) }}
                        placeholder="URL audio (opsional)"
                        className="rounded-lg text-[11px] h-7"
                      />
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setEditSoalForm({ ...editSoalForm, extras: [...(editSoalForm.extras || []), { text: '', imageUrl: '', audioUrl: '' }] })} className="rounded-full border-amber-300 text-amber-700 hover:bg-amber-50">+ Tambah distractor</Button>
              </div>
            )}
            {editSoalForm.jenis === 'isian' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Jawaban Benar</Label>
                <Input value={editSoalForm.jawabanBenar} onChange={(e) => setEditSoalForm({ ...editSoalForm, jawabanBenar: e.target.value })} dir="rtl" className="font-arabic text-right text-xl rounded-xl" />
              </div>
            )}
            {/* FIX v3.2.3 #5: isAudio toggle di edit dialog */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Switch checked={editSoalForm.isAudio || false} onCheckedChange={(v) => setEditSoalForm({ ...editSoalForm, isAudio: v })} />
              <div>
                <p className="text-sm font-semibold text-amber-800">🎧 Audio TTS (Text-to-Speech)</p>
                <p className="text-xs text-amber-600">Kalau aktif: mahasiswa dengar lafaz Arabic via TTS browser (max 2x play, anti-cheat).</p>
              </div>
            </div>
            {/* Media fields untuk Edit Soal */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Media Soal (opsional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Image URL
                  </Label>
                  <Input value={editSoalForm.imageUrl} onChange={(e) => setEditSoalForm({ ...editSoalForm, imageUrl: e.target.value })} placeholder="https://...jpg" className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                    <Video className="w-3 h-3" /> Video URL (YouTube/upload)
                  </Label>
                  <Input value={editSoalForm.videoUrl} onChange={(e) => setEditSoalForm({ ...editSoalForm, videoUrl: e.target.value })} placeholder="https://youtube.com/..." className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                    <Music className="w-3 h-3" /> Audio URL (mp3)
                  </Label>
                  <Input value={editSoalForm.audioUrl} onChange={(e) => setEditSoalForm({ ...editSoalForm, audioUrl: e.target.value })} placeholder="https://...mp3" className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Embed URL (iframe)
                  </Label>
                  <Input value={editSoalForm.embedUrl} onChange={(e) => setEditSoalForm({ ...editSoalForm, embedUrl: e.target.value })} placeholder="https://..." className="rounded-xl text-sm" />
                </div>
              </div>
              {(editSoalForm.imageUrl || editSoalForm.audioUrl) && (
                <div className="mt-2 pt-2 border-t border-blue-200 space-y-2">
                  {/* FIX v3.0.5: image preview square 1:1 */}
                  {editSoalForm.imageUrl && (
                    <div className="aspect-square w-32 h-32 rounded-lg border overflow-hidden bg-gray-50">
                      <img src={editSoalForm.imageUrl} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {editSoalForm.audioUrl && <audio controls src={editSoalForm.audioUrl} className="w-full h-9" preload="none" />}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Bobot</Label>
                <Input type="number" step="0.5" value={editSoalForm.bobot} onChange={(e) => setEditSoalForm({ ...editSoalForm, bobot: parseFloat(e.target.value) || 1 })} className="rounded-xl" />
              </div>
            </div>
            {/* Fase & Kategori untuk Edit Soal */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-violet-800">Fase & Kategori (opsional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Fase</Label>
                  <Input
                    type="number"
                    value={editSoalForm.fase}
                    onChange={(e) => setEditSoalForm({ ...editSoalForm, fase: e.target.value })}
                    placeholder="Tanpa fase"
                    min="1"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Kategori</Label>
                  <Input
                    value={editSoalForm.kategori}
                    onChange={(e) => setEditSoalForm({ ...editSoalForm, kategori: e.target.value })}
                    placeholder="Mis. Mufrodat"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white sticky bottom-0 rounded-b-2xl">
            <Button variant="outline" onClick={() => setEditSoalDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={saveEditSoal} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sesi Tes"
        description={`${list.length} sesi terdaftar`}
        action={
          <Button onClick={openCreate} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-1" /> Buat Sesi Tes
          </Button>
        }
      />

      {list.length === 0 ? (
        <EmptyState title="Belum ada sesi ujian" description="Klik tombol di atas untuk membuat sesi pertama" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(s => (
            <Card
              key={s.id}
              className={`cursor-pointer hover:shadow-md transition rounded-2xl border-0 shadow-soft ${s.aktif ? 'ring-2 ring-emerald-300' : ''}`}
              onClick={() => openDetail(s)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{s.nama}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{s.level?.nama}</p>
                  </div>
                  <Badge variant={s.aktif ? 'success' : 'default'}>{s.aktif ? 'Aktif' : 'Selesai'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 text-xs text-gray-500 mb-3 flex-wrap">
                  <span><Badge variant="info">{s.mode}</Badge></span>
                  <span>{s.durasiMenit} menit</span>
                  <span>{s._count?.soal ?? 0} soal</span>
                  <span>{s._count?.hasil ?? 0} hasil</span>
                </div>
                {(s.acakUrutan || s.jumlahSoalPerMahasiswa) && (
                  <div className="mb-3 pt-3 border-t border-dashed border-gray-200 flex flex-wrap gap-1">
                    {s.acakUrutan && <Badge variant="purple"><Shuffle className="w-3 h-3 mr-1 inline" /> Acak</Badge>}
                    {s.jumlahSoalPerMahasiswa && <Badge variant="gold">{s.jumlahSoalPerMahasiswa}/mhs</Badge>}
                  </div>
                )}
                <p className="text-xs text-gray-400">{new Date(s.tanggalMulai).toLocaleString('id-ID')}</p>
                <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="rounded-full">Edit</Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 rounded-full" onClick={() => hapus(s.id)}>Hapus</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* FIX #6: layout flex col + sticky footer (sama seperti dialog edit soal) */}
        <DialogContent className="max-w-2xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle>{editing ? 'Edit Sesi' : 'Buat Sesi Tes'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Nama Sesi</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Tes Mufrodat Hari 1" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Level</Label>
              <Select value={form.levelId} onValueChange={(v) => setForm({ ...form, levelId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online (auto-koreksi)</SelectItem>
                    <SelectItem value="offline">Offline (penguji input)</SelectItem>
                    <SelectItem value="hybrid">Hybrid (gabungan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Durasi (menit)</Label>
                <Input type="number" value={form.durasiMenit} onChange={(e) => setForm({ ...form, durasiMenit: parseInt(e.target.value) || 30 })} className="rounded-xl" />
              </div>
            </div>

            {/* Schedule: tanggal + jam mulai/selesai */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Waktu Pelaksanaan</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tanggal Pelaksanaan</Label>
                <Input
                  type="date"
                  value={form.tanggalMulai}
                  onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Jam Mulai</Label>
                  <Input
                    type="time"
                    value={form.jamMulai}
                    onChange={(e) => setForm({ ...form, jamMulai: e.target.value })}
                    placeholder="08:00"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Jam Selesai</Label>
                  <Input
                    type="time"
                    value={form.jamSelesai}
                    onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })}
                    placeholder="10:00"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Randomization settings */}
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-semibold text-violet-800">Pengaturan Acak (Anti-Contek)</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Acak urutan soal per mahasiswa</Label>
                  <p className="text-xs text-gray-500">Setiap mahasiswa dapat urutan soal berbeda</p>
                </div>
                <Switch checked={form.acakUrutan} onCheckedChange={(v) => setForm({ ...form, acakUrutan: v })} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ambil N soal random dari total</Label>
                <p className="text-xs text-gray-500">Kosongkan untuk ambil semua. Mis. isi 30 → tiap mahasiswa dapat 30 soal random dari total.</p>
                <Input
                  type="number"
                  value={form.jumlahSoalPerMahasiswa}
                  onChange={(e) => setForm({ ...form, jumlahSoalPerMahasiswa: e.target.value })}
                  placeholder="Mis. 30 (kosongkan untuk semua)"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.gunakanFase} onCheckedChange={(v) => setForm({ ...form, gunakanFase: v })} />
              <div>
                <Label>Bagi soal per Fase</Label>
                <p className="text-xs text-gray-500">Soal diacak per fase — fase 1 muncul dulu, lalu 2, dst</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.aktif} onCheckedChange={(v) => setForm({ ...form, aktif: v })} />
              <Label>Aktif (mahasiswa bisa kerjakan)</Label>
            </div>
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white sticky bottom-0 rounded-b-2xl">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-full">Batal</Button>
            <Button onClick={save} className="rounded-full bg-emerald-600 hover:bg-emerald-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// PesertaTab — admin atur siapa yang berhak ikut ujian
function PesertaTab({ sesi, onSaved }: { sesi: any; onSaved: () => void }) {
  const [allMhs, setAllMhs] = useState<any[]>([])
  const [selectedNims, setSelectedNims] = useState<string[]>([])
  const [allowAll, setAllowAll] = useState(true)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      // FIX v2.9.1: pass take=2000 untuk ambil SEMUA mahasiswa (sebelumnya default 100, banyak mhs gak muncul di selector peserta ujian)
      fetch('/api/mahasiswa?take=2000').then(r => r.json()),
    ]).then(([mhsData]) => {
      setAllMhs(mhsData.data || [])
      // Load existing pesertaJson
      if (sesi.pesertaJson) {
        try {
          const arr = JSON.parse(sesi.pesertaJson)
          if (Array.isArray(arr) && arr.length > 0) {
            setSelectedNims(arr)
            setAllowAll(false)
          }
        } catch {}
      }
      setLoading(false)
    })
  }, [sesi.id])

  function toggleNim(nim: string) {
    setSelectedNims(prev =>
      prev.includes(nim) ? prev.filter(n => n !== nim) : [...prev, nim]
    )
    setAllowAll(false)
  }

  function toggleAll() {
    if (allowAll) {
      setAllowAll(false)
      setSelectedNims([])
    } else {
      setAllowAll(true)
      setSelectedNims([])
    }
  }

  function selectUnfinished() {
    // Centang mahasiswa yang belum mengikuti ujian
    const finishedNims = new Set((sesi.hasil || []).map((h: any) => h.mahasiswa?.nim).filter(Boolean))
    const unfinished = allMhs.filter(m => !finishedNims.has(m.nim)).map(m => m.nim)
    setSelectedNims(unfinished)
    setAllowAll(false)
  }

  async function savePeserta() {
    const pesertaJson = allowAll ? null : JSON.stringify(selectedNims)
    const res = await fetch('/api/sesi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-peserta', sesiId: sesi.id, pesertaJson }),
    })
    if (res.ok) {
      toast({ title: 'Peserta tersimpan', description: allowAll ? 'Semua mahasiswa diizinkan' : `${selectedNims.length} mahasiswa dipilih` })
      onSaved()
    }
  }

  const filteredMhs = allMhs.filter(m =>
    !search ||
    m.nama.toLowerCase().includes(search.toLowerCase()) ||
    m.nim.includes(search)
  )

  if (loading) return <Loading />

  return (
    <Card className="rounded-2xl border border-gray-200 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Peserta Tes</CardTitle>
        <p className="text-xs text-gray-500">Pilih siapa saja yang berhak mengikuti ujian ini</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <input
            type="checkbox"
            checked={allowAll}
            onChange={toggleAll}
            className="w-5 h-5 rounded"
          />
          <span className="text-sm font-semibold text-blue-800">Izinkan semua mahasiswa</span>
        </div>

        {/* Quick actions */}
        {!allowAll && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={selectUnfinished} className="rounded-xl">
              Centang yang Belum Ikut
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setSelectedNims(allMhs.map(m => m.nim)); setAllowAll(false) }} className="rounded-xl">
              Centang Semua
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSelectedNims([]); setAllowAll(false) }} className="rounded-xl text-rose-600">
              Kosongkan
            </Button>
            <span className="text-xs text-gray-500 self-center ml-auto">{selectedNims.length} dari {allMhs.length} dipilih</span>
          </div>
        )}

        {/* Mahasiswa list */}
        {!allowAll && (
          <>
            <Input
              placeholder="Cari nama/NIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl max-w-xs"
            />
            <div className="max-h-96 overflow-y-auto scroll-thin border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 w-10"></th>
                    <th className="text-left py-2 px-3">NIM</th>
                    <th className="text-left py-2 px-3">Nama</th>
                    <th className="text-left py-2 px-3">Kamar</th>
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMhs.map(m => {
                    const hasHasil = (sesi.hasil || []).some((h: any) => h.mahasiswaId === m.id)
                    return (
                      <tr key={m.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleNim(m.nim)}>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={selectedNims.includes(m.nim)}
                            onChange={() => toggleNim(m.nim)}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono">{m.nim}</td>
                        <td className="py-2 px-3">{m.nama}</td>
                        <td className="py-2 px-3">{m.kamar?.nama}</td>
                        <td className="py-2 px-3">
                          {hasHasil ? <Badge variant="success">Sudah</Badge> : <Badge variant="default">Belum</Badge>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <Button onClick={savePeserta} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          Simpan Peserta
        </Button>
      </CardContent>
    </Card>
  )
}
