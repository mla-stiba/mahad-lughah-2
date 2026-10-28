'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { useCSVImport } from '@/hooks/use-csv-import'
import { ArabicText, EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { FileUpload } from '@/components/shared/FileUpload'
import { Plus, Edit2, Trash2, Image as ImageIcon, Video, FileText, Music, Link as LinkIcon, ExternalLink, Loader2, Package, PackageOpen, Calendar, BookOpen } from 'lucide-react'
import { PaketMateriTab } from './PaketMateriTab'

export function MateriView() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<any[]>([])
  const [levelList, setLevelList] = useState<any[]>([])
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterJenis, setFilterJenis] = useState('all')
  const [filterKategori, setFilterKategori] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [csvText, setCsvText] = useState('')
  // FIX v3.0.5: state untuk total items di semua paket — supaya PageHeader count
  // include items di paket, bukan hanya materi lepas.
  const [totalPaketItems, setTotalPaketItems] = useState(0)

  const [form, setForm] = useState({
    jenis: 'mufrodat' as 'mufrodat' | 'tarkib',
    arabic: '', arti: '', contoh: '', kategori: '', levelId: '',
    imageUrl: '', videoUrl: '', audioUrl: '', documentUrl: '', externalLink: '', socialEmbed: '',
    tanggalRilis: '',
  })

  async function load() {
    setLoading(true)
    const [matR, levelR, paketR] = await Promise.all([
      // FIX v2.9.2: paketId=lepas → hanya materi yang TIDAK ada di paket (tab "Materi Lepas")
      fetch(`/api/materi?levelId=${filterLevel}&jenis=${filterJenis}&paketId=lepas`).then(r => r.json()),
      fetch('/api/master?action=level').then(r => r.json()),
      // FIX v3.0.5: fetch paket list untuk hitung total items di paket
      fetch('/api/paket-materi').then(r => r.json()),
    ])
    setList(matR.data || [])
    setLevelList(levelR.data || [])
    // FIX v3.0.5: total items = sum dari _count.items untuk semua paket
    const allPakets = paketR?.data || []
    const totalItems = allPakets.reduce((sum: number, p: any) => sum + (p._count?.items || 0), 0)
    setTotalPaketItems(totalItems)
    if (levelR.data && levelR.data.length > 0 && !form.levelId) {
      setForm(f => ({ ...f, levelId: levelR.data[0].id }))
    }
    setLoading(false)
  }

  // FIX v2.9.2: hapus SEMUA materi bebas (paketId IS NULL). Materi di paket TIDAK terhapus.
  async function hapusSemuaLepas() {
    if (list.length === 0) {
      toast({ title: 'Tidak ada materi lepas untuk dihapus', variant: 'destructive' })
      return
    }
    if (!confirm(`Hapus SEMUA ${list.length} materi bebas (di luar paket)?\n\nMateri yang ada di dalam paket TIDAK akan terhapus.\nTindakan ini tidak bisa dibatalkan.`)) return
    try {
      const r = await fetch('/api/materi?action=delete-all-lepas', { method: 'DELETE' }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: `✅ ${r.deleted} materi bebas dihapus`, description: 'Materi di dalam paket tetap aman' })
      load()
    } catch (e: any) {
      toast({ title: 'Gagal hapus', description: e.message, variant: 'destructive' })
    }
  }

  useEffect(() => { load() }, [filterLevel, filterJenis])

  function openCreate() {
    setEditing(null)
    setForm({
      jenis: (filterJenis !== 'all' ? filterJenis : 'mufrodat') as any,
      arabic: '', arti: '', contoh: '', kategori: '',
      levelId: filterLevel !== 'all' ? filterLevel : (levelList[0]?.id || ''),
      imageUrl: '', videoUrl: '', audioUrl: '', documentUrl: '', externalLink: '', socialEmbed: '',
      tanggalRilis: new Date().toISOString().slice(0, 10),
    })
    setDialogOpen(true)
  }

  function openEdit(m: any) {
    setEditing(m)
    setForm({
      jenis: m.jenis, arabic: m.arabic, arti: m.arti,
      contoh: m.contoh || '', kategori: m.kategori || '', levelId: m.levelId,
      imageUrl: m.imageUrl || '', videoUrl: m.videoUrl || '', audioUrl: m.audioUrl || '',
      documentUrl: m.documentUrl || '', externalLink: m.externalLink || '', socialEmbed: m.socialEmbed || '',
      tanggalRilis: m.tanggalRilis ? new Date(m.tanggalRilis).toISOString().slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.arabic || !form.arti || !form.levelId) {
      toast({ title: 'Lengkapi Arabic, arti, dan level', variant: 'destructive' })
      return
    }
    const method = editing ? 'PATCH' : 'POST'
    const body = editing ? { id: editing.id, ...form } : form
    const res = await fetch('/api/materi', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: editing ? 'Diperbarui' : 'Ditambah' })
      setDialogOpen(false)
      load()
    } else {
      toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus materi ini?')) return
    await fetch(`/api/materi?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Dihapus' })
    load()
  }

  const csvImport = useCSVImport()

  async function importCSV() {
    if (!csvText.trim()) {
      toast({ title: 'CSV kosong', variant: 'destructive' })
      return
    }
    const levelId = form.levelId || levelList[0]?.id
    const ok = await csvImport.importWithProgress('/api/import?action=materi', { csv: csvText, levelId })
    if (ok && csvImport.result) {
      const r = csvImport.result
      toast({
        title: `Import: ${r.created} baru, ${r.updated} update`,
        description: r.errors.length ? `${r.errors.length} baris gagal (lihat detail di bawah)` : undefined,
        variant: r.errors.length ? 'destructive' : 'default',
      })
      setCsvText('')
      csvImport.reset()
      load()
    } else if (csvImport.error) {
      toast({ title: 'Gagal', description: csvImport.error, variant: 'destructive' })
    }
  }

  const kategoriList = Array.from(new Set(list.map(m => m.kategori).filter(Boolean)))

  const filtered = list.filter(m => {
    if (filterKategori !== 'all' && m.kategori !== filterKategori) return false
    if (search) {
      const q = search.toLowerCase()
      return m.arabic.includes(search) || m.arti.toLowerCase().includes(q) || (m.kategori || '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) return <Loading />

  // Helper: parse socialEmbed (JSON string)
  function parseSocial(s: string | null): { platform?: string; url?: string } | null {
    if (!s) return null
    try { return JSON.parse(s) } catch { return null }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Materi Hafalan"
        // FIX v3.0.5: count SEMUA materi (lepas + items di paket), bukan hanya materi lepas.
        description={`${list.length + totalPaketItems} materi (${list.length} lepas + ${totalPaketItems} di paket)`}
        action={
          <Button onClick={openCreate} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10 px-4">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Materi
          </Button>
        }
      />

      <Tabs defaultValue="paket">
        <TabsList className="bg-gray-100 rounded-xl p-1 h-10">
          <TabsTrigger value="paket" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Paket Materi</TabsTrigger>
          <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Materi Lepas</TabsTrigger>
          <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Import Batch</TabsTrigger>
        </TabsList>

        {/* FIX #4: Tab Paket Materi (admin manage paket) */}
        <TabsContent value="paket" className="space-y-4 mt-4">
          <PaketMateriTab levelList={levelList} />
        </TabsContent>

        <TabsContent value="list" className="space-y-4 mt-4">
          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Cari Arabic/arti..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs rounded-xl h-10" />
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-48 rounded-xl h-10"><SelectValue placeholder="Semua level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Marhalah</SelectItem>
                {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="mufrodat">Mufrodat</SelectItem>
                <SelectItem value="tarkib">Tarkib</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterKategori} onValueChange={setFilterKategori}>
              <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {kategoriList.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* FIX v2.9.2: tombol hapus SEMUA materi bebas (yang TIDAK ada di paket) */}
            <Button
              variant="outline"
              onClick={hapusSemuaLepas}
              disabled={list.length === 0}
              className="ml-auto rounded-xl h-10 border-rose-300 text-rose-600 hover:bg-rose-50 hover:border-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Hapus semua materi yang tidak ada di paket (paketId=null)"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Hapus Semua Materi Lepas
            </Button>
          </div>

          {/* Materi grid */}
          {filtered.length === 0 ? (
            <Card className="rounded-2xl border border-gray-200 shadow-soft"><CardContent><EmptyState title="Belum ada materi" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(m => {
                const social = parseSocial(m.socialEmbed)
                const hasMedia = m.imageUrl || m.videoUrl || m.audioUrl || m.documentUrl || m.externalLink || social
                return (
                  <Card key={m.id} className="rounded-2xl border border-gray-200 shadow-soft hover:shadow-md transition overflow-hidden">
                    {/* Image preview — FIX v2.9.9: aspect-square 1:1 (sebelumnya aspect-video 16:9) */}
                    {m.imageUrl && (
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        <img src={m.imageUrl} alt={m.arti} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant={m.jenis === 'mufrodat' ? 'info' : 'warning'}>{m.jenis}</Badge>
                        {m.kategori && <span className="text-xs text-gray-500">{m.kategori}</span>}
                      </div>
                      {/* Arabic */}
                      <div className="text-right py-2 bg-emerald-50/50 rounded-lg px-3">
                        <ArabicText size="lg" className="text-emerald-800">{m.arabic}</ArabicText>
                      </div>
                      <p className="font-semibold text-gray-900">{m.arti}</p>
                      {m.contoh && (
                        <div className="text-right text-sm text-gray-500 bg-gray-50 rounded px-2 py-1">
                          <ArabicText size="sm" className="text-gray-600">{m.contoh}</ArabicText>
                        </div>
                      )}
                      {/* Media indicators */}
                      {hasMedia && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-dashed border-gray-200">
                          {m.audioUrl && <Badge variant="success"><Music className="w-3 h-3 mr-0.5 inline" /> Audio</Badge>}
                          {m.imageUrl && <Badge variant="info"><ImageIcon className="w-3 h-3 mr-0.5 inline" /> Gambar</Badge>}
                          {m.videoUrl && <Badge variant="danger"><Video className="w-3 h-3 mr-0.5 inline" /> Video</Badge>}
                          {m.documentUrl && <Badge variant="default"><FileText className="w-3 h-3 mr-0.5 inline" /> Doc</Badge>}
                          {m.externalLink && <Badge variant="purple"><LinkIcon className="w-3 h-3 mr-0.5 inline" /> Link</Badge>}
                          {social && <Badge variant="gold">{social.platform || 'Social'}</Badge>}
                        </div>
                      )}
                      {/* Audio player */}
                      {m.audioUrl && (
                        <audio controls src={m.audioUrl} className="w-full h-9 mt-1" preload="none" />
                      )}
                      {/* External link */}
                      {m.externalLink && (
                        <a href={m.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Buka referensi
                        </a>
                      )}
                      <div className="flex gap-1 pt-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(m)} className="rounded-lg h-8 px-2">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 rounded-lg h-8 px-2" onClick={() => hapus(m.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card className="rounded-2xl border border-gray-200 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Import Materi via CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target Marhalah</Label>
                <Select value={form.levelId || levelList[0]?.id} onValueChange={(v) => setForm({ ...form, levelId: v })} disabled={csvImport.loading}>
                  <SelectTrigger className="w-72 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-gray-500">Format: <code className="bg-gray-100 px-1 rounded">jenis,arabic,arti,kategori,contoh,audio_url,image_url,video_url,document_url,link</code></p>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                placeholder={`jenis,arabic,arti,kategori,contoh,audio_url\nmufrodat,أَبٌ,ayah,keluarga,هَذَا أَبِي,\ntarkib,هَذَا...,Ini (lk),isyarat,هَذَا كِتَابٌ,`}
                className="font-mono text-sm rounded-xl"
                disabled={csvImport.loading}
              />
              {csvImport.loading && csvImport.progress && (
                <div className="space-y-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-emerald-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Memproses import...
                      {csvImport.progress.phase && (
                        <span className="text-emerald-600 font-normal">
                          ({csvImport.progress.phase === 'create' ? 'tambah baru' : 'update existing'} {csvImport.progress.chunk}/{csvImport.progress.total})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-emerald-600">
                      {csvImport.progress.processed || 0} / {csvImport.progress.total_rows || 0} baris
                      {csvImport.progress.created !== undefined && (
                        <span className="ml-2">| ✅ {csvImport.progress.created} baru</span>
                      )}
                      {csvImport.progress.updated !== undefined && csvImport.progress.updated > 0 && (
                        <span className="ml-1">| ✏️ {csvImport.progress.updated} update</span>
                      )}
                    </span>
                  </div>
                  <Progress
                    value={
                      csvImport.progress.total_rows
                        ? ((csvImport.progress.processed || 0) / csvImport.progress.total_rows) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
              )}
              {csvImport.result && csvImport.result.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 max-h-40 overflow-y-auto">
                  <p className="font-semibold mb-1">⚠️ {csvImport.result.errors.length} baris gagal diproses:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {csvImport.result.errors.map((e, i) => (
                      <li key={i} className="font-mono">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                onClick={importCSV}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                disabled={csvImport.loading || !csvText.trim()}
              >
                {csvImport.loading ? 'Memproses...' : 'Import'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Dialog Tambah/Edit Materi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Materi' : 'Tambah Materi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Jenis</Label>
                <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v as any })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mufrodat">Mufrodat (kosa kata)</SelectItem>
                    <SelectItem value="tarkib">Tarkib (pola kalimat)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Marhalah</Label>
                <Select value={form.levelId} onValueChange={(v) => setForm({ ...form, levelId: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Arabic (dengan harakat)</Label>
              <Input value={form.arabic} onChange={(e) => setForm({ ...form, arabic: e.target.value })} dir="rtl" className="font-arabic text-right text-2xl rounded-xl" placeholder="أَبٌ" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Arti (Bahasa Indonesia)</Label>
                <Input value={form.arti} onChange={(e) => setForm({ ...form, arti: e.target.value })} placeholder="ayah" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Kategori</Label>
                <Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder="keluarga" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Contoh Kalimat (Arabic)</Label>
              <Input value={form.contoh} onChange={(e) => setForm({ ...form, contoh: e.target.value })} dir="rtl" className="font-arabic text-right rounded-xl" placeholder="هَذَا أَبِي" />
            </div>

            {/* Media Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Media (opsional)</p>
              <div className="grid grid-cols-2 gap-3">
                <FileUpload label="Gambar" accept="image/*" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} preview="image" />
                <FileUpload label="Video" accept="video/*" value={form.videoUrl} onChange={(v) => setForm({ ...form, videoUrl: v })} preview="video" />
                <FileUpload label="Audio (mp3)" accept="audio/*" value={form.audioUrl} onChange={(v) => setForm({ ...form, audioUrl: v })} preview="audio" />
                <FileUpload label="Document" accept="application/pdf" value={form.documentUrl} onChange={(v) => setForm({ ...form, documentUrl: v })} preview="none" />
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> External Link</Label>
                  <Input value={form.externalLink} onChange={(e) => setForm({ ...form, externalLink: e.target.value })} placeholder="https://referensi..." className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Social Embed (JSON)</Label>
                  <Input value={form.socialEmbed} onChange={(e) => setForm({ ...form, socialEmbed: e.target.value })} placeholder='{"platform":"instagram","url":"..."}' className="rounded-xl text-xs font-mono" />
                </div>
              </div>
            </div>

            {/* Tanggal Rilis */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Tanggal Rilis</Label>
              <Input
                type="date"
                value={form.tanggalRilis}
                onChange={(e) => setForm({ ...form, tanggalRilis: e.target.value })}
                className="rounded-xl"
              />
              <p className="text-xs text-gray-500">Materi akan tampil ke mahasiswa mulai tanggal ini. Kosongkan jika masih draft.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
