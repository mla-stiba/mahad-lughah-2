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
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { useCSVImport } from '@/hooks/use-csv-import'
import { EmptyState, Loading, Badge, PageHeader } from '@/components/shared'
import { Plus, Edit2, Trash2, Crown, Phone, Download, Loader2 } from 'lucide-react'

export function MahasiswaView() {
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState<any[]>([])
  const [kamarList, setKamarList] = useState<any[]>([])
  const [filterKamar, setFilterKamar] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [csvText, setCsvText] = useState('')

  const [form, setForm] = useState({
    nim: '', nama: '', wa: '', tanggalLahir: '', isKetuaKamar: false, kamarId: '',
  })

  async function load() {
    setLoading(true)
    // FIX v2.9.1: saat "Semua Kamar" dipilih, ambil SEMUA mahasiswa (take=2000 = max cap API).
    // Sebelumnya default API take=100, jadi hanya 100 mahasiswa pertama yang muncul di list.
    const takeParam = filterKamar === 'all' ? 2000 : 500
    const [mhsR, kamarR] = await Promise.all([
      fetch(`/api/mahasiswa?kamarId=${filterKamar}&take=${takeParam}`).then(r => r.json()),
      fetch('/api/master?action=kamar').then(r => r.json()),
    ])
    setList(mhsR.data || [])
    setKamarList(kamarR.data || [])
    if (kamarR.data && kamarR.data.length > 0 && !form.kamarId) {
      setForm(f => ({ ...f, kamarId: kamarR.data[0].id }))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterKamar])

  function openCreate() {
    setEditing(null)
    setForm({
      nim: '', nama: '', wa: '', tanggalLahir: '', isKetuaKamar: false, kamarId: kamarList[0]?.id || '',
    })
    setDialogOpen(true)
  }

  function openEdit(m: any) {
    setEditing(m)
    setForm({
      nim: m.nim, nama: m.nama, wa: m.wa || '', tanggalLahir: m.tanggalLahir || '', isKetuaKamar: m.isKetuaKamar || false, kamarId: m.kamarId,
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.nim || !form.nama || !form.kamarId) {
      toast({ title: 'Lengkapi NIM, nama, dan kamar', variant: 'destructive' })
      return
    }
    if (form.nim.length !== 10) {
      toast({ title: 'NIM harus 10 digit', variant: 'destructive' })
      return
    }
    const url = '/api/mahasiswa'
    const method = editing ? 'PATCH' : 'POST'
    const body = editing ? { id: editing.id, ...form } : form
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    if (!confirm('Hapus mahasiswa ini?')) return
    await fetch(`/api/mahasiswa?id=${id}`, { method: 'DELETE' })
    toast({ title: 'Dihapus' })
    load()
  }

  const csvImport = useCSVImport()

  async function importCSV() {
    if (!csvText.trim()) {
      toast({ title: 'CSV kosong', variant: 'destructive' })
      return
    }
    const ok = await csvImport.importWithProgress('/api/import?action=mahasiswa', { csv: csvText })
    if (ok && csvImport.result) {
      const r = csvImport.result
      toast({
        title: `Import selesai: ${r.created} baru, ${r.updated} update`,
        description: r.errors.length ? `${r.errors.length} baris gagal (lihat detail di bawah)` : undefined,
        variant: r.errors.length ? 'destructive' : 'default',
      })
      setCsvText('')
      csvImport.reset()
      load()
    } else if (csvImport.error) {
      toast({ title: 'Gagal import', description: csvImport.error, variant: 'destructive' })
    }
  }

  const filtered = list.filter(m =>
    !search ||
    m.nama.toLowerCase().includes(search.toLowerCase()) ||
    m.nim.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Loading />

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Data Mahasiswa"
        description={`${list.length} mahasiswa terdaftar`}
        action={
          <Button onClick={openCreate} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-10 px-4">
            <Plus className="w-4 h-4 mr-1.5" /> Tambah Mahasiswa
          </Button>
        }
      />

      <Tabs defaultValue="list">
        <TabsList className="bg-gray-100 rounded-xl p-1 h-10">
          <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Daftar Mahasiswa</TabsTrigger>
          <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Import Batch via CSV</TabsTrigger>
          <TabsTrigger value="template" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <Input placeholder="Cari nama/NIM..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs rounded-xl h-10" />
            <Select value={filterKamar} onValueChange={setFilterKamar}>
              <SelectTrigger className="w-48 rounded-xl h-10"><SelectValue placeholder="Semua kamar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kamar</SelectItem>
                {kamarList.map(k => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-2xl border border-gray-200 shadow-soft">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <EmptyState title="Belum ada mahasiswa" description="Tambah manual atau import CSV" />
              ) : (
                <div className="overflow-x-auto scroll-thin max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4">NIM</th>
                        <th className="text-left py-3 px-4">Nama</th>
                        <th className="text-left py-3 px-4">WA</th>
                        <th className="text-left py-3 px-4">Kamar</th>
                        <th className="text-left py-3 px-4">Ketua?</th>
                        <th className="text-right py-3 px-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(m => (
                        <tr key={m.id} className="border-b hover:bg-gray-50">
                          <td className="py-2.5 px-4"><Badge variant="info">{m.nim}</Badge></td>
                          <td className="py-2.5 px-4 font-medium">
                            {m.isKetuaKamar && <Crown className="w-3.5 h-3.5 text-amber-500 inline mr-1" />}
                            {m.nama}
                          </td>
                          <td className="py-2.5 px-4 text-gray-600">
                            {m.wa ? (
                              <a href={`https://wa.me/${m.wa.replace(/^0/, '62')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                                <Phone className="w-3 h-3" /> {m.wa}
                              </a>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="py-2.5 px-4">{m.kamar?.nama}</td>
                          <td className="py-2.5 px-4">
                            {m.isKetuaKamar ? <Badge variant="gold"><Crown className="w-3 h-3 mr-1 inline" /> Ketua</Badge> : <span className="text-gray-400">Anggota</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(m)} className="rounded-lg h-8 w-8 p-0">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-rose-600 rounded-lg h-8 w-8 p-0" onClick={() => hapus(m.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card className="rounded-2xl border border-gray-200 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Import Mahasiswa via CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">Format CSV: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">nim,nama,wa,tanggal_lahir,is_ketua_kamar,kamar</code>. Baris pertama harus header. is_ketua_kamar bisa <code className="bg-gray-100 px-1">ya</code>/<code className="bg-gray-100 px-1">tidak</code>.</p>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={10}
                placeholder={`nim,nama,wa,tanggal_lahir,is_ketua_kamar,kamar
2024000026,Fulan Bin Fulan,081234567890,2005-04-15,tidak,Kamar A1
2024000027,Fulanah Binti Fulan,081234567891,2006-08-20,ya,Kamar B1`}
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
                {csvImport.loading ? 'Memproses...' : 'Import Sekarang'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="space-y-4 mt-4">
          <Card className="rounded-2xl border border-gray-200 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Template CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">Download template siap pakai untuk Excel/Google Sheets:</p>
              <a href="/api/import?action=template-mahasiswa" target="_blank">
                <Button variant="outline" className="rounded-xl">
                  <Download className="w-4 h-4 mr-1.5" /> Download Template Mahasiswa
                </Button>
              </a>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">{`nim,nama,wa,tanggal_lahir,is_ketua_kamar,kamar
2657184001,RAFIE ABQARY MUSTAFA,6281342945521,2005-04-15,ya,08.02.01
2657184002,MUHAMMAD BILAL AS'AD,6282311113693,2003-08-20,tidak,08.02.01
2657184003,AISYAH PUTRI,6282347761499,2004-12-05,tidak,08.01.01`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">NIM (10 digit)</Label>
              <Input value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="2024000001" className="rounded-xl font-mono" maxLength={10} />
              {form.nim.length > 0 && form.nim.length < 10 && (
                <p className="text-xs text-rose-600">NIM harus 10 digit ({form.nim.length}/10)</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Nama Lengkap</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Nomor WhatsApp</Label>
              <Input value={form.wa} onChange={(e) => setForm({ ...form, wa: e.target.value })} placeholder="081234567890" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Tanggal Lahir (password = DDMMYYYY)</Label>
              <Input
                type="date"
                value={form.tanggalLahir}
                onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })}
                className="rounded-xl"
              />
              {form.tanggalLahir && (
                <p className="text-xs text-emerald-600">
                  Password mahasiswa: <strong>{form.tanggalLahir.split('-').reverse().join('')}</strong> (DDMMYYYY)
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Kamar</Label>
              <Select value={form.kamarId} onValueChange={(v) => setForm({ ...form, kamarId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih kamar" /></SelectTrigger>
                <SelectContent>
                  {kamarList.map(k => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Switch checked={form.isKetuaKamar} onCheckedChange={(v) => setForm({ ...form, isKetuaKamar: v })} />
              <div className="flex-1">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-600" /> Ketua Kamar
                </Label>
                <p className="text-xs text-gray-500">Centang jika mahasiswa ini adalah ketua kamarnya</p>
              </div>
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
