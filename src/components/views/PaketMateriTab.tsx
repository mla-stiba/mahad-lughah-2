'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ArabicText, EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { Plus, Edit2, Trash2, Package, PackageOpen, Calendar, BookOpen, Loader2, X, Sparkles, CheckCircle2, FileText, Image as ImageIcon, Music, Video, Link2 } from 'lucide-react'

// ============ TAB PAKET MATERI (FIX #4) ============
// Admin manage PaketMateri (grup dari banyak mufrodat/uslub + media)
// Struktur xlsx: Pekan | Tema | Hari | Jenis | Arabic | Terjemahan

export function PaketMateriTab({ levelList }: { levelList: any[] }) {
  const [loading, setLoading] = useState(true)
  const [paketList, setPaketList] = useState<any[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  // FIX v3.0.5: state untuk edit item (mufrodat/tarkib di dalam paket)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false)
  const [editItemForm, setEditItemForm] = useState({
    jenis: 'mufrodat',
    arabic: '',
    arti: '',
    contoh: '',
    kategori: '',
    imageUrl: '',
    audioUrl: '',
    videoUrl: '',
    documentUrl: '',
    externalLink: '',
  })
  const [detailPaket, setDetailPaket] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterLevel, setFilterLevel] = useState('all')

  const [form, setForm] = useState({
    nama: '',
    levelId: '',
    tema: '',
    pekan: '',
    kategori: '',
    deskripsi: '',
    imageUrl: '',
    tanggalRilis: '',
  })

  // State untuk add item ke paket
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [itemForm, setItemForm] = useState({
    jenis: 'mufrodat',
    arabic: '',
    arti: '',
    contoh: '',
    kategori: '',
    imageUrl: '',
    audioUrl: '',
    videoUrl: '',
  })

  // State untuk script generator (batch import materi ke paket)
  const [scriptDialogOpen, setScriptDialogOpen] = useState(false)
  const [scriptTargetPaket, setScriptTargetPaket] = useState<any | null>(null)
  const [scriptText, setScriptText] = useState(`## [mufrodat]
arabic: أَبٌ
arti: ayah
contoh: هَذَا أَبِي
kategori: keluarga

---

## [mufrodat]
arabic: أُمٌّ
arti: ibu
kategori: keluarga

---

## [tarkib]
arabic: الْكِتَابُ مَفْتُوحٌ
arti: buku terbuka
`)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<{ created: number; errors: string[] } | null>(null)

  async function loadPaket() {
    setLoading(true)
    try {
      const r = await fetch(`/api/paket-materi?levelId=${filterLevel}`).then(r => r.json())
      setPaketList(r.data || [])
    } catch (e: any) {
      toast({ title: 'Gagal load paket', description: e.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  useEffect(() => { loadPaket() }, [filterLevel])

  function openCreate() {
    setEditing(null)
    setForm({
      nama: '', levelId: levelList[0]?.id || '', tema: '', pekan: '', kategori: '',
      deskripsi: '', imageUrl: '', tanggalRilis: '',
    })
    setDialogOpen(true)
  }

  function openEdit(p: any) {
    setEditing(p)
    setForm({
      nama: p.nama || '', levelId: p.levelId || '', tema: p.tema || '', pekan: p.pekan?.toString() || '',
      kategori: p.kategori || '', deskripsi: p.deskripsi || '', imageUrl: p.imageUrl || '',
      tanggalRilis: p.tanggalRilis ? new Date(p.tanggalRilis).toISOString().slice(0, 10) : '',
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.nama || !form.levelId) {
      toast({ title: 'Nama + Level wajib', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = '/api/paket-materi'
      const method = editing ? 'PATCH' : 'POST'
      const body = editing ? { id: editing.id, ...form } : form
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: editing ? '✅ Paket diupdate' : '✅ Paket dibuat' })
      setDialogOpen(false)
      loadPaket()
    } catch (e: any) {
      toast({ title: 'Gagal simpan', description: e.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  async function hapus(id: string, nama: string) {
    if (!confirm(`Hapus paket "${nama}"? Items akan jadi materi lepas.`)) return
    await fetch(`/api/paket-materi?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Paket dihapus' })
    loadPaket()
  }

  async function openDetail(p: any) {
    try {
      const r = await fetch(`/api/paket-materi?id=${p.id}`).then(r => r.json())
      setDetailPaket(r.data)
    } catch (e: any) {
      toast({ title: 'Gagal load detail', description: e.message, variant: 'destructive' })
    }
  }

  async function addItem() {
    if (!itemForm.arabic || !itemForm.arti) {
      toast({ title: 'Arabic + Arti wajib', variant: 'destructive' })
      return
    }
    try {
      // Create materi lepas dengan paketId = detailPaket.id
      const r = await fetch('/api/materi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemForm,
          levelId: detailPaket.levelId,
          paketId: detailPaket.id,
        }),
      }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: '✅ Item ditambahkan' })
      setItemForm({
        jenis: 'mufrodat', arabic: '', arti: '', contoh: '', kategori: '',
        imageUrl: '', audioUrl: '', videoUrl: '',
      })
      // Refresh detail paket
      openDetail(detailPaket)
    } catch (e: any) {
      toast({ title: 'Gagal tambah item', description: e.message, variant: 'destructive' })
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Hapus item ini dari paket?')) return
    await fetch(`/api/materi?id=${itemId}`, { method: 'DELETE' })
    toast({ title: 'Item dihapus' })
    openDetail(detailPaket)
  }

  // ===== FIX v3.0.5: EDIT ITEM (mufrodat/tarkib di dalam paket) =====
  // Buka dialog edit dengan field lengkap (jenis, arabic, arti, contoh, kategori, + media URLs).
  function openEditItem(item: any) {
    setEditingItem(item)
    setEditItemForm({
      jenis: item.jenis || 'mufrodat',
      arabic: item.arabic || '',
      arti: item.arti || '',
      contoh: item.contoh || '',
      kategori: item.kategori || '',
      imageUrl: item.imageUrl || '',
      audioUrl: item.audioUrl || '',
      videoUrl: item.videoUrl || '',
      documentUrl: item.documentUrl || '',
      externalLink: item.externalLink || '',
    })
    setEditItemDialogOpen(true)
  }

  async function saveEditItem() {
    if (!editingItem) return
    if (!editItemForm.arabic || !editItemForm.arti) {
      toast({ title: 'Arabic + Arti wajib', variant: 'destructive' })
      return
    }
    try {
      const r = await fetch('/api/materi', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          jenis: editItemForm.jenis,
          arabic: editItemForm.arabic,
          arti: editItemForm.arti,
          contoh: editItemForm.contoh || null,
          kategori: editItemForm.kategori || null,
          imageUrl: editItemForm.imageUrl || null,
          audioUrl: editItemForm.audioUrl || null,
          videoUrl: editItemForm.videoUrl || null,
          documentUrl: editItemForm.documentUrl || null,
          externalLink: editItemForm.externalLink || null,
        }),
      }).then(r => r.json())
      if (r.error) throw new Error(r.error)
      toast({ title: '✅ Item diperbarui' })
      setEditItemDialogOpen(false)
      setEditingItem(null)
      // Refresh detail paket untuk lihat perubahan
      if (detailPaket) openDetail(detailPaket)
    } catch (e: any) {
      toast({ title: 'Gagal update', description: e.message, variant: 'destructive' })
    }
  }

  // ===== SCRIPT GENERATOR (batch import materi ke paket) =====
  function openScriptDialog(paket: any) {
    setScriptTargetPaket(paket)
    setGenerateResult(null)
    setScriptDialogOpen(true)
  }

  async function generateFromScript() {
    if (!scriptTargetPaket) return
    if (!scriptText.trim()) {
      toast({ title: 'Script kosong', variant: 'destructive' })
      return
    }
    setGenerating(true)
    setGenerateResult(null)
    try {
      const res = await fetch('/api/paket-materi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-from-script',
          paketId: scriptTargetPaket.id,
          script: scriptText,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
      } else {
        toast({
          title: `${data.created} item ditambahkan`,
          description: data.errors?.length ? `${data.errors.length} baris gagal — lihat detail` : 'Semua item berhasil dibuat',
        })
        setGenerateResult({ created: data.created, errors: data.errors || [] })
        // Refresh detail paket
        if (detailPaket?.id === scriptTargetPaket.id) {
          openDetail(scriptTargetPaket)
        }
      }
    } catch (e: any) {
      toast({ title: 'Network error', description: e.message, variant: 'destructive' })
    }
    setGenerating(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Paket Materi</h3>
          <Badge variant="info">{paketList.length} paket</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-40 rounded-xl h-9"><SelectValue placeholder="Filter level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Level</SelectItem>
              {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-9">
            <Plus className="w-4 h-4 mr-1" /> Buat Paket
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Paket Materi = grup mufrodat + uslub + media per pekan/tema.
        Contoh: "Pekan 3 - في الغرفة" berisi 20 mufrodat + 5 uslub tentang kamar.
      </p>

      {paketList.length === 0 ? (
        <EmptyState title="Belum ada paket materi" description="Buat paket pertama untuk mengelompokkan materi per pekan/tema" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paketList.map(p => (
            <Card key={p.id} className="rounded-2xl border border-gray-200 shadow-soft hover:shadow-md transition cursor-pointer overflow-hidden" onClick={() => openDetail(p)}>
              {p.imageUrl && (
                // FIX v2.9.9: aspect-square 1:1 (sebelumnya aspect-video 16:9)
                <div className="aspect-square bg-gray-100">
                  <img src={p.imageUrl} alt={p.nama} className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{p.nama}</CardTitle>
                    {p.tema && <ArabicText size="sm" className="text-emerald-700 mt-1">{p.tema}</ArabicText>}
                  </div>
                  {p.pekan && <Badge variant="gold" className="text-[10px]">Pekan {p.pekan}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-2 space-y-2">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <PackageOpen className="w-3 h-3" />
                    {p._count?.items || 0} item
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {p.level?.nama}
                  </span>
                  {p.tanggalRilis && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.tanggalRilis).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                {p.deskripsi && <p className="text-xs text-gray-600 line-clamp-2">{p.deskripsi}</p>}
                <div className="flex gap-1 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="rounded-lg h-8 px-2" title="Edit paket">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openScriptDialog(p)} className="rounded-lg h-8 px-2 text-emerald-600" title="Import batch via script">
                    <Sparkles className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 rounded-lg h-8 px-2" onClick={() => hapus(p.id, p.nama)} title="Hapus paket">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Create/Edit Paket */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle>{editing ? 'Edit Paket' : 'Buat Paket Materi'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase">Nama Paket</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Pekan 3 - في الغرفة" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase">Level</Label>
                <Select value={form.levelId} onValueChange={(v) => setForm({ ...form, levelId: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {levelList.map(l => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase">Pekan ke-</Label>
                <Input type="number" value={form.pekan} onChange={(e) => setForm({ ...form, pekan: e.target.value })} placeholder="3" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase">Tema (Arabic)</Label>
              <Input value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} dir="rtl" className="font-arabic text-right text-lg rounded-xl" placeholder="في الغرفة" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase">Deskripsi (opsional)</Label>
              <Textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={2} placeholder="Materi tentang kamar dan isinya" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase">Image URL (thumbnail paket)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://...jpg" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase">Tanggal Rilis (kosong = draft)</Label>
              <Input type="date" value={form.tanggalRilis} onChange={(e) => setForm({ ...form, tanggalRilis: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white rounded-b-2xl">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Update' : 'Buat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detail Paket + Add Item */}
      {detailPaket && (
        <Dialog open={!!detailPaket} onOpenChange={(o) => !o && setDetailPaket(null)}>
          <DialogContent className="max-w-3xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
            <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {detailPaket.nama}
                {detailPaket.tema && <ArabicText size="md" className="text-emerald-700">{detailPaket.tema}</ArabicText>}
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-1">
                {detailPaket.level?.nama} · {detailPaket.items?.length || 0} item
                {detailPaket.pekan && ` · Pekan ${detailPaket.pekan}`}
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* List items */}
              {detailPaket.items?.length === 0 ? (
                <EmptyState title="Belum ada item di paket ini" description="Tambah mufrodat/uslub di bawah" />
              ) : (
                <div className="space-y-2">
                  {detailPaket.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50">
                      <Badge variant={item.jenis === 'mufrodat' ? 'info' : 'warning'} className="flex-shrink-0">{item.jenis}</Badge>
                      <div className="flex-1 min-w-0">
                        <ArabicText size="md" className="text-gray-900">{item.arabic}</ArabicText>
                        <p className="text-sm text-gray-600">{item.arti}</p>
                        {item.contoh && <ArabicText size="xs" className="text-gray-500 mt-1">{item.contoh}</ArabicText>}
                        {/* FIX v3.0.5: tampilkan info kategori + media icons supaya user lihat lengkap */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.kategori && <span className="text-[10px] text-gray-400">{item.kategori}</span>}
                          {item.imageUrl && <ImageIcon className="w-3 h-3 text-blue-500" />}
                          {item.audioUrl && <Music className="w-3 h-3 text-emerald-500" />}
                          {item.videoUrl && <Video className="w-3 h-3 text-purple-500" />}
                          {item.documentUrl && <FileText className="w-3 h-3 text-amber-500" />}
                          {item.externalLink && <Link2 className="w-3 h-3 text-cyan-500" />}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {/* FIX v3.0.5: tombol Edit item — buka dialog edit dengan field lengkap (sama seperti Add Item) */}
                        <Button size="sm" variant="ghost" onClick={() => openEditItem(item)} className="rounded-lg h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" title="Edit item">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 rounded-lg h-8 w-8 p-0" onClick={() => deleteItem(item.id)} title="Hapus item">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Add Item */}
              <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Tambah Item ke Paket
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openScriptDialog(detailPaket)}
                    className="rounded-lg h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" /> Import Batch via Script
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={itemForm.jenis} onValueChange={(v) => setItemForm({ ...itemForm, jenis: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mufrodat">Mufrodat</SelectItem>
                      <SelectItem value="tarkib">Tarkib / Uslub</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={itemForm.kategori} onChange={(e) => setItemForm({ ...itemForm, kategori: e.target.value })} placeholder="Kategori (opsional)" className="rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Arabic</Label>
                    <Input value={itemForm.arabic} onChange={(e) => setItemForm({ ...itemForm, arabic: e.target.value })} dir="rtl" className="font-arabic text-right text-lg rounded-xl" placeholder="أَبٌ" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Arti</Label>
                    <Input value={itemForm.arti} onChange={(e) => setItemForm({ ...itemForm, arti: e.target.value })} placeholder="Ayah" className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contoh (opsional)</Label>
                  <Input value={itemForm.contoh} onChange={(e) => setItemForm({ ...itemForm, contoh: e.target.value })} dir="rtl" className="font-arabic text-right rounded-xl" placeholder="هَذَا أَبِي" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input value={itemForm.imageUrl} onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })} placeholder="Image URL" className="rounded-xl text-xs" />
                  <Input value={itemForm.audioUrl} onChange={(e) => setItemForm({ ...itemForm, audioUrl: e.target.value })} placeholder="Audio URL" className="rounded-xl text-xs" />
                  <Input value={itemForm.videoUrl} onChange={(e) => setItemForm({ ...itemForm, videoUrl: e.target.value })} placeholder="Video URL" className="rounded-xl text-xs" />
                </div>
                <Button onClick={addItem} size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 w-full">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
                </Button>
              </div>
            </div>
            <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white rounded-b-2xl">
              <Button variant="outline" onClick={() => setDetailPaket(null)} className="rounded-xl">Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ===== Dialog Script Generator (batch import materi ke paket) ===== */}
      <Dialog open={scriptDialogOpen} onOpenChange={setScriptDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Import Batch Materi via Script
            </DialogTitle>
            {scriptTargetPaket && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Package className="w-3 h-3" />
                Target paket: <span className="font-semibold text-gray-700">{scriptTargetPaket.nama}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Help format */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-2">
              <p className="font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Format Script (sinkron dengan generator soal):
              </p>
              <pre className="text-xs whitespace-pre-wrap font-mono">{`## [mufrodat]              ← mulai block, jenis wajib (mufrodat | tarkib)
arabic: أَبٌ                ← teks Arab (wajib)
arti: ayah                 ← terjemahan (wajib)
contoh: هَذَا أَبِي           ← (opsional) contoh kalimat
kategori: keluarga          ← (opsional) tema/kategori
audio: https://...mp3      ← (opsional) URL audio
gambar: https://...jpg     ← (opsional) URL gambar
video: https://...mp4      ← (opsional) URL video

---                         ← pisah antar item dengan ---

## [tarkib]
arabic: الْكِتَابُ مَفْتُوحٌ
arti: buku terbuka`}</pre>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Script Materi</Label>
              <Textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={14}
                className="font-mono text-sm rounded-xl"
                placeholder={`## [mufrodat]\narabic: أَبٌ\narti: ayah\n\n---\n\n## [tarkib]\narabic: الْكِتَابُ جَدِيدٌ\narti: buku baru`}
              />
            </div>

            {/* Result panel */}
            {generateResult && (
              <div className={`p-3 rounded-xl border ${generateResult.errors.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className={`w-4 h-4 ${generateResult.errors.length ? 'text-amber-600' : 'text-emerald-600'}`} />
                  <span className={generateResult.errors.length ? 'text-amber-800' : 'text-emerald-800'}>
                    {generateResult.created} item berhasil ditambahkan ke paket
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
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white rounded-b-2xl">
            <Button variant="outline" onClick={() => setScriptDialogOpen(false)} className="rounded-xl">Tutup</Button>
            <Button onClick={generateFromScript} disabled={generating} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Sedang generate...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" /> Generate & Tambah ke Paket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== FIX v3.0.5: Dialog Edit Item (mufrodat/tarkib di dalam paket) =====
           Field sama seperti Add Item + tambahan media URLs (imageUrl, audioUrl, videoUrl, dll). */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl flex flex-col p-0 gap-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-emerald-600" />
              Edit Item Paket
            </DialogTitle>
            {editingItem && (
              <p className="text-xs text-gray-500 mt-1">
                <Badge variant={editingItem.jenis === 'mufrodat' ? 'info' : 'warning'} className="text-[10px]">{editingItem.jenis}</Badge>
                <ArabicText size="sm" className="text-gray-700 inline-block ml-2">{editingItem.arabic}</ArabicText>
                {' · '}
                <span>{editingItem.arti}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={editItemForm.jenis} onValueChange={(v) => setEditItemForm({ ...editItemForm, jenis: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mufrodat">Mufrodat</SelectItem>
                  <SelectItem value="tarkib">Tarkib / Uslub</SelectItem>
                </SelectContent>
              </Select>
              <Input value={editItemForm.kategori} onChange={(e) => setEditItemForm({ ...editItemForm, kategori: e.target.value })} placeholder="Kategori (opsional)" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Arabic</Label>
                <Input value={editItemForm.arabic} onChange={(e) => setEditItemForm({ ...editItemForm, arabic: e.target.value })} dir="rtl" className="font-arabic text-right text-lg rounded-xl" placeholder="أَبٌ" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arti</Label>
                <Input value={editItemForm.arti} onChange={(e) => setEditItemForm({ ...editItemForm, arti: e.target.value })} placeholder="Ayah" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contoh (opsional)</Label>
              <Input value={editItemForm.contoh} onChange={(e) => setEditItemForm({ ...editItemForm, contoh: e.target.value })} dir="rtl" className="font-arabic text-right rounded-xl" placeholder="هَذَا أَبِي" />
            </div>
            {/* FIX v3.0.5: media fields — sama seperti Add Item di MateriView */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input value={editItemForm.imageUrl} onChange={(e) => setEditItemForm({ ...editItemForm, imageUrl: e.target.value })} placeholder="https://...jpg" className="rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Audio URL</Label>
                <Input value={editItemForm.audioUrl} onChange={(e) => setEditItemForm({ ...editItemForm, audioUrl: e.target.value })} placeholder="https://...mp3" className="rounded-xl text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Video URL</Label>
                <Input value={editItemForm.videoUrl} onChange={(e) => setEditItemForm({ ...editItemForm, videoUrl: e.target.value })} placeholder="https://...mp4" className="rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Document URL</Label>
                <Input value={editItemForm.documentUrl} onChange={(e) => setEditItemForm({ ...editItemForm, documentUrl: e.target.value })} placeholder="https://...pdf" className="rounded-xl text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">External Link</Label>
              <Input value={editItemForm.externalLink} onChange={(e) => setEditItemForm({ ...editItemForm, externalLink: e.target.value })} placeholder="https://..." className="rounded-xl text-xs" />
            </div>
          </div>
          <DialogFooter className="p-4 pt-3 shrink-0 border-t border-gray-200 bg-white rounded-b-2xl">
            <Button variant="outline" onClick={() => setEditItemDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={saveEditItem} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Edit2 className="w-3.5 h-3.5 mr-1" /> Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
