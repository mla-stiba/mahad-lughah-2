'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
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
  // FIX v3.5.5: simpan paket list untuk hitung jumlah paket di description PageHeader.
  const [paketList, setPaketList] = useState<any[]>([])

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
    // FIX v3.5.5: simpan paket list untuk description PageHeader.
    setPaketList(allPakets)
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
        description={`${totalPaketItems} materi di ${paketList.length} paket`}
      />

      <PaketMateriTab levelList={levelList} />

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
              <p className="text-xs text-gray-500">Materi akan tampil ke mahasiswi mulai tanggal ini. Kosongkan jika masih draft.</p>
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
