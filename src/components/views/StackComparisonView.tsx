'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Check, X, AlertTriangle } from 'lucide-react'

export function StackComparisonView({ onPick }: { onPick: (stack: 'nextjs' | 'gas' | 'forms') => void }) {
  const [activeTab, setActiveTab] = useState('compare')

  const stacks = [
    {
      id: 'nextjs',
      nama: 'Next.js + Supabase + Vercel',
      tagline: 'Aplikasi web penuh (yang Anda pakai sekarang)',
      color: 'emerald',
      gratis: 'Free tier cukup ~100 mahasiswa',
      fitur: {
        'UI Arabic RTL': true,
        '5 tipe soal (isian, MCQ, terjemahan, matching, audio)': true,
        'Auth multi-role (penguji + mahasiswa)': true,
        'Import CSV/Sheet (batch)': true,
        'Dashboard cross-tab heatmap': true,
        'Per-mahasiswa progres': true,
        'Per-kamar ranking': true,
        'Export PDF/Excel laporan': true,
        'Multi-level materi': true,
        'Custom tipe skor per soal': true,
        'Real-time (live hasil saat ujian)': true,
        'Audio recording (penguji nilai manual)': true,
        'Branding sendiri (logo, warna)': true,
        'Mobile-friendly responsive': true,
      },
      pros: [
        'Full kontrol UI & UX Arabic',
        'Skalabel (bisa ribuan mahasiswa)',
        'Open source, no vendor lock-in',
        'Komunitas besar, banyak referensi',
        'Bisa hosting sendiri kalau perlu',
      ],
      cons: [
        'Perlu deployment awal (~10 menit setup)',
        'Perlu pengembang untuk fitur baru',
        'Free tier Vercel/Supabase ada limit (tapi cukup untuk pesantren)',
      ],
    },
    {
      id: 'gas',
      nama: 'Google Apps Script + Google Sheets',
      tagline: 'Gratis murni, berbasis spreadsheet',
      color: 'amber',
      gratis: 'Sepenuhnya gratis (Google account)',
      fitur: {
        'UI Arabic RTL': false,
        '5 tipe soal (isian, MCQ, terjemahan, matching, audio)': 'partial',
        'Auth multi-role (penguji + mahasiswa)': false,
        'Import CSV/Sheet (batch)': true,
        'Dashboard cross-tab heatmap': false,
        'Per-mahasiswa progres': 'partial',
        'Per-kamar ranking': true,
        'Export PDF/Excel laporan': true,
        'Multi-level materi': 'partial',
        'Custom tipe skor per soal': false,
        'Real-time (live hasil saat ujian)': false,
        'Audio recording (penguji nilai manual)': false,
        'Branding sendiri (logo, warna)': false,
        'Mobile-friendly responsive': 'partial',
      },
      pros: [
        'Gratis sepenuhnya',
        'Tidak perlu server, langsung dari Google Drive',
        'Auto-backup oleh Google',
        'Cocok untuk ujian sederhana (MCQ saja)',
      ],
      cons: [
        'UX Arabic sangat terbatas (RTL tidak native)',
        'Tidak ada auth proper (pakai link sharing)',
        'Tidak ada real-time (refresh manual)',
        'Cross-tab heatmap mustahil dilakukan tanpa coding ekstensif',
        'Audio recording tidak didukung',
        '5 tipe soal hanya bisa MCQ + isian sederhana',
        'Limitasi quota harian Google (untuk skala besar)',
      ],
    },
    {
      id: 'forms',
      nama: 'Google Forms + Google Sheets',
      tagline: 'Paling sederhana, survei-like',
      color: 'sky',
      gratis: 'Sepenuhnya gratis',
      fitur: {
        'UI Arabic RTL': false,
        '5 tipe soal (isian, MCQ, terjemahan, matching, audio)': false,
        'Auth multi-role (penguji + mahasiswa)': false,
        'Import CSV/Sheet (batch)': false,
        'Dashboard cross-tab heatmap': false,
        'Per-mahasiswa progres': false,
        'Per-kamar ranking': 'partial',
        'Export PDF/Excel laporan': 'partial',
        'Multi-level materi': false,
        'Custom tipe skor per soal': false,
        'Real-time (live hasil saat ujian)': 'partial',
        'Audio recording (penguji nilai manual)': false,
        'Branding sendiri (logo, warna)': false,
        'Mobile-friendly responsive': true,
      },
      pros: [
        'Gratis, nol setup',
        'Mahasiswa familiar dengan Google',
        'Cocok untuk survey/feedback',
      ],
      cons: [
        'Tidak ada fitur ujian sungguhan (tidak ada timer per-soal)',
        'Tidak ada skor otomatis (kecuali MCQ sederhana)',
        'Tidak ada database relasional ( Sheet saja)',
        'Tidak ada auth mahasiswa (link sharing saja)',
        'Tidak ada progress per-mahasiswa lintas sesi',
        'Tidak ada chart interaktif',
        'Hanya cocok untuk 1 sesi sekali pakai',
      ],
    },
  ]

  function getIcon(val: any) {
    if (val === true) return <Check className="w-4 h-4 text-emerald-600" />
    if (val === false) return <X className="w-4 h-4 text-rose-400" />
    return <AlertTriangle className="w-4 h-4 text-amber-500" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Perbandingan Stack</h2>
        <p className="text-sm text-gray-500 mt-1">Berdasarkan praktik komunitas developer (bukan marketing vendor)</p>
      </div>

      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4">
          <p className="text-sm text-emerald-800">
            <strong>💡 Saran:</strong> Untuk kebutuhan ujian hafalan mufrodat &amp; uslub dengan 5 tipe soal, multi-level, dashboard cross-tab, dan audio — <strong>Next.js + Supabase</strong> adalah pilihan terbaik. Google Apps Script dan Forms hanya cocok untuk survei sederhana, bukan ujian hafalan sungguhan.
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="compare">Tabel Perbandingan</TabsTrigger>
          <TabsTrigger value="nextjs">Next.js (Detail)</TabsTrigger>
          <TabsTrigger value="gas">Google Apps Script (Mockup)</TabsTrigger>
          <TabsTrigger value="forms">Google Forms (Mockup)</TabsTrigger>
        </TabsList>

        <TabsContent value="compare" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-3 w-1/3">Fitur</th>
                      {stacks.map(s => (
                        <th key={s.id} className="text-center py-3 px-3 w-1/4">
                          <div>
                            <p className="font-bold">{s.nama}</p>
                            <p className="text-xs text-gray-500 mt-1">{s.gratis}</p>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(stacks[0].fitur).map(fitur => (
                      <tr key={fitur} className="border-b">
                        <td className="py-2 px-3 text-gray-700">{fitur}</td>
                        {stacks.map(s => (
                          <td key={s.id} className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center">
                              {getIcon((s.fitur as any)[fitur])}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {stacks.map(s => (
              <Card key={s.id} className={s.id === 'nextjs' ? 'border-emerald-300' : ''}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {s.nama}
                    {s.id === 'nextjs' && <Badge variant="success">Rekomendasi</Badge>}
                  </CardTitle>
                  <CardDescription>{s.tagline}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-emerald-700 mb-1">✓ Kelebihan:</p>
                    <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                      {s.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-rose-700 mb-1">✗ Kekurangan:</p>
                    <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                      {s.cons.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nextjs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Next.js + Supabase + Vercel — Inilah Yang Anda Pakai</CardTitle>
              <CardDescription>Lihat demo live di tab lain aplikasi ini</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Stack yang Anda lihat sekarang. Dibangun dengan Next.js 16, Prisma ORM, SQLite (production: PostgreSQL via Supabase), Tailwind CSS, Recharts, shadcn/ui. Font Arabic: Amiri dari Google Fonts (RTL proper).
              </p>
              <ul className="text-sm space-y-1 ml-4 list-disc text-gray-700">
                <li>Login penguji: <code className="bg-gray-100 px-1">penguji / penguji123</code></li>
                <li>Login mahasiswa: pakai kode <code className="bg-gray-100 px-1">MLA-001</code> s/d <code className="bg-gray-100 px-1">MLA-025</code></li>
                <li>Database: 25 mahasiswa, 5 kamar, 47 materi (mufrodat + uslub), 3 sesi ujian dengan hasil dummy</li>
                <li>5 tipe soal: isian, MCQ, terjemahan ID-AR, matching, audio (mock)</li>
                <li>Dashboard: per-kamar bar chart, per-materi item analysis, cross-tab heatmap kamar × soal</li>
                <li>Import CSV: paste textarea, otomatis update/create</li>
              </ul>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
                <p className="text-sm text-emerald-800">
                  <strong>Untuk produksi:</strong> Deploy ke Vercel (gratis), pakai Supabase untuk database PostgreSQL (gratis 500MB). Total biaya operasional: <strong>Rp 0/bulan</strong> untuk ≤100 mahasiswa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mockup: Tampilan Google Apps Script</CardTitle>
              <CardDescription>Begini kira-kira tampilannya jika pakai GAS + Sheets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 rounded p-4 border-2 border-dashed border-gray-300">
                <div className="bg-white rounded shadow p-3 max-w-2xl mx-auto">
                  <div className="text-xs text-gray-500 mb-2">📋 https://script.google.com/macros/s/AKfycby.../exec</div>
                  <div className="space-y-3">
                    <p className="text-lg font-bold text-gray-900">Tes Mufrodat Hari 1</p>
                    <div className="text-xs text-gray-500">Durasi: 30 menit &middot; 10 soal</div>
                    <div className="space-y-3 mt-4">
                      <div className="border-l-4 border-amber-400 pl-3">
                        <p className="text-sm">Soal 1: Tuliskan dalam Arab "ayah"</p>
                        <input className="border px-2 py-1 w-full text-sm" placeholder="Ketik jawaban..." disabled />
                        <p className="text-xs text-amber-700 mt-1">⚠️ RTL/Arabic font tidak didukung — teks Arab akan tampil LTR</p>
                      </div>
                      <div className="border-l-4 border-rose-400 pl-3">
                        <p className="text-sm">Soal 2: Matching pairs</p>
                        <p className="text-xs text-rose-700">❌ Tidak didukung — harus pakai soal MCQ saja</p>
                      </div>
                      <div className="border-l-4 border-rose-400 pl-3">
                        <p className="text-sm">Soal 3: Audio hafalan lisan</p>
                        <p className="text-xs text-rose-700">❌ Tidak didukung — penguji harus input manual di Sheet</p>
                      </div>
                    </div>
                    <button className="bg-amber-600 text-white px-4 py-2 rounded text-sm" disabled>Submit (refresh manual)</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 italic">Hasil tersimpan di Sheet "Responses" — penguji lihat &amp; nilai manual</p>
                </div>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-sm text-amber-800">
                  <strong>Kesimpulan:</strong> GAS bisa berjalan, tapi banyak fitur yang harus diorat/in (RTL Arabic, matching, audio, real-time, cross-tab heatmap, per-mahasiswa progress). Cocok hanya untuk MCQ sederhana.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mockup: Google Forms</CardTitle>
              <CardDescription>Begini kira-kira tampilannya jika pakai Google Forms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 rounded p-4 border-2 border-dashed border-gray-300">
                <div className="bg-white rounded shadow p-3 max-w-2xl mx-auto">
                  <div className="flex items-center gap-2 mb-3 border-b pb-2">
                    <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center text-white text-xs">📝</div>
                    <span className="text-sm font-medium">Google Forms</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">Tes Mufrodat Hari 1</p>
                  <p className="text-xs text-gray-500">Required</p>
                  <div className="space-y-3 mt-4">
                    <div className="border-l-4 border-rose-400 pl-3">
                      <p className="text-sm">Soal 1: Tuliskan Arab "ayah"</p>
                      <input className="border px-2 py-1 w-full text-sm" placeholder="Jawaban..." disabled />
                      <p className="text-xs text-rose-700 mt-1">❌ Tidak ada input RTL/Arabic font</p>
                    </div>
                    <div className="border-l-4 border-amber-400 pl-3">
                      <p className="text-sm">Soal 2: Apa arti "أَبٌ"?</p>
                      <div className="space-y-1 text-sm">
                        <label><input type="radio" disabled /> ayah</label><br />
                        <label><input type="radio" disabled /> ibu</label><br />
                        <label><input type="radio" disabled /> anak</label><br />
                      </div>
                      <p className="text-xs text-amber-700 mt-1">⚠️ MCQ sederhana bisa, tapi teks Arab tampil LTR</p>
                    </div>
                    <div className="border-l-4 border-rose-400 pl-3">
                      <p className="text-sm">Soal 3: Matching pasangan Arabic-Indonesia</p>
                      <p className="text-xs text-rose-700">❌ Tipe soal tidak ada — harus dibuat MCQ terpisah per pasangan</p>
                    </div>
                    <div className="border-l-4 border-rose-400 pl-3">
                      <p className="text-sm">Soal 4: Audio hafalan</p>
                      <p className="text-xs text-rose-700">❌ Tidak ada — mahasiswa harus submit link GDrive manual</p>
                    </div>
                  </div>
                  <button className="bg-sky-600 text-white px-4 py-2 rounded text-sm" disabled>Submit</button>
                  <p className="text-xs text-gray-400 mt-3 italic">Hasil: Sheet baru, no chart, no progress per-mahasiswa</p>
                </div>
              </div>
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded p-3">
                <p className="text-sm text-rose-800">
                  <strong>Kesimpulan:</strong> Google Forms hanya cocok untuk survei. Tidak ada timer per-soal, tidak ada skor otomatis untuk isian, tidak ada per-mahasiswa progress, tidak ada cross-tab. Tidak direkomendasikan untuk ujian hafalan.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-emerald-300">
        <CardHeader>
          <CardTitle>Keputusan Anda?</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button onClick={() => onPick('nextjs')} className="bg-emerald-600 hover:bg-emerald-700">
            ✓ Saya pilih Next.js (lanjut pakai aplikasi ini)
          </Button>
          <Button variant="outline" onClick={() => onPick('gas')}>
            Saya tetap mau GAS (saya buat versi Sheet terpisah)
          </Button>
          <Button variant="outline" onClick={() => onPick('forms')}>
            Saya tetap mau Google Forms
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
