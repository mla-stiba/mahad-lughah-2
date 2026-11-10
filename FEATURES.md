# Ma'had Lughah — Daftar Fitur Lengkap (Admin & Mahasiswa Portal)

> Dokumen ini merangkum **SEMUA fitur** yang ada di aplikasi Ma'had Lughah — aplikasi ujian & hafalan kosakata Bahasa Arab untuk pesantren.
>
> **Stack:** Next.js 16 + Prisma + PostgreSQL (Supabase) + Vercel
>
> **Target pengguna:** Admin/Penguji (pengelola pesantren) & Mahasiswa santri

---

## Daftar Isi

### Portal Admin
1. [Dashboard](#1-dashboard)
2. [Data Mahasiswa](#2-data-mahasiswa)
3. [Materi (Paket & Lepas)](#3-materi-paket--lepas)
4. [Sesi Tes (Ujian)](#4-sesi-tes-ujian)
5. [Hasil & Analisis](#5-hasil--analisis)
6. [Kegiatan Kamar](#6-kegiatan-kamar)
7. [Evaluasi Per Mahasiswa](#7-evaluasi-per-mahasiswa)
8. [Pengaturan](#8-pengaturan)

### Portal Mahasiswa
9. [Login & PWA Install](#9-login--pwa-install)
10. [Tes (Ujian)](#10-tes-ujian)
11. [Materi Mahasiswa](#11-materi-mahasiswa)
12. [Progres Saya](#12-progres-saya)
13. [Kamar Saya (Ketua Kamar)](#13-kamar-saya-ketua-kamar)

### Sistem & Fitur Lintas Portal
14. [Anti-Cheat System](#14-anti-cheat-system)
15. [TTS Arabic (Text-to-Speech)](#15-tts-arabic-text-to-speech)
16. [Auto-Submit & Deadline System](#16-auto-submit--deadline-system)
17. [Randomisasi Soal per Mahasiswa](#17-randomisasi-soal-per-mahasiswa)
18. [localStorage Persistence](#18-localstorage-persistence)
19. [Manual Grade Override](#19-manual-grade-override)
20. [WhatsApp Share Integration](#20-whatsapp-share-integration)
21. [PWA (Progressive Web App)](#21-pwa-progressive-web-app)
22. [Cron Job Harian](#22-cron-job-harian)
23. [Sistem Notifikasi](#23-sistem-notifikasi)

### Lampiran
- [Database Schema (Prisma Models)](#database-schema-prisma-models)
- [Daftar Lengkap API Routes](#daftar-lengkap-api-routes)
- [Skor & Grading System](#skor--grading-system)
- [Tipe Soal yang Didukung](#tipe-soal-yang-didukung)

---

# PORTAL ADMIN

## 1. Dashboard

**Lokasi file:** `src/components/views/DashboardView.tsx` (769 baris)
**Akses:** Admin & Penguji
**Tujuan:** Ringkasan statistik & grafik untuk monitoring kinerja pesantren.

### 1.1 Stat Cards (5 kartu di atas)

| Kartu | Deskripsi | Sumber Data |
|-------|-----------|-------------|
| **Status Pengerjaan Tes** | Sudah/belum/total untuk sesi aktif terbaru | `/api/sesi?aktif=true` + `?action=belum-kerja` |
| **Mahasiswa** | Total mhs + total kamar | `/api/hasil?action=overview` |
| **Sesi Tes** | Total sesi + total hasil ujian | `/api/hasil?action=overview` |
| **Materi** | Total mufrodat + tarkib | `/api/hasil?action=overview` |
| **Rata-rata Skor** | Rata-rata skor semua hasil submitted/graded | `/api/hasil?action=overview` |

### 1.2 Grafik "Rata-rata Skor per Kamar"

- Bar chart (Recharts, tinggi 380px, XAxis diputar -90°)
- Filter: dialog "Pilih Ujian" dengan checklist semua sesi (default: semua tercentang)
- Tombol cepat: "Centang Semua" / "Kosongkan"
- Komputasi real-time dari `allHasil` yang sudah difilter berdasarkan `selectedSesiIds`

### 1.3 Grafik "Distribusi Skor"

- Donut chart (PieChart, innerRadius 60, outerRadius 90)
- 6 kategori:
  - **A (ممتاز)** — ≥90%, hijau
  - **B (جيد جداً)** — 80-89%, biru
  - **C (جيد)** — 65-79%, amber
  - **D (مقبول)** — 50-64%, oranye
  - **F (ضعيف)** — <50%, merah
  - **GHAIB (غائب)** — tidak ikut ujian, abu-abu
- Tooltip & legend menampilkan count + persentase
- Tombol **"Salin Laporan Ujian"** → copy pesan WhatsApp terformat (template: 📊 LAPORAN HASIL UJIAN MUFRADAT LEVEL 1- MA'HAD LUGHA IAI STIBA MAKASSAR, dengan periode, tanggal ujian, distribusi A-F + GHAIB, persen ≥80, jumlah perlu binaan)

### 1.4 Grafik "Progres Hafalan Mufrodat per Kamar"

- Bar chart persentase hafalan per kamar
- Filter: dialog "Pilih Paket Materi" (default: semua paket tercentang)
- Tooltip menampilkan: persentase + hafal/total mufrodat

### 1.5 Modals

- Dialog **"Pilih Ujian untuk Grafik"** (checklist sesi)
- Dialog **"Pilih Paket Materi untuk Grafik Hafalan"** (checklist paket)

---

## 2. Data Mahasiswa

**Lokasi file:** `src/components/views/MahasiswaView.tsx` (371 baris)
**Akses:** Admin & Penguji
**Tujuan:** CRUD data santri + import batch.

### 2.1 Tab "Daftar Mahasiswa"

- Tabel searchable: NIM, Nama, WA (click-to-WhatsApp), Kamar, badge Ketua?
- Filter dropdown by kamar
- Search by nama/NIM
- Ambil 2000 record saat "Semua Kamar" dipilih
- Tombol Edit (pensil) + Hapus (trash) per baris
- `isKetuaKamar` ditandai dengan ikon mahkota

### 2.2 Tab "Import Batch via CSV"

- Textarea paste CSV + tombol "Import Now"
- Format: `nim,nama,wa,tanggal_lahir,is_ketua_kamar,kamar`
- Progress bar real-time via SSE (Server-Sent Events)
- Menampilkan created/updated per chunk (CHUNK_SIZE=50) + list error

### 2.3 Tab "Template"

- Download CSV template
- Preview sample data

### 2.4 Dialog Add/Edit Mahasiswa

| Field | Tipe | Validasi |
|-------|------|----------|
| NIM | Text | 10 digit, numeric only |
| Nama Lengkap | Text | Required |
| Nomor WhatsApp | Text | Numeric |
| Tanggal Lahir | Date picker | Password default = DDMMYYYY |
| Kamar | Dropdown | Wajib |
| isKetuaKamar | Switch | Boolean |

---

## 3. Materi (Paket & Lepas)

**Lokasi file:** `src/components/views/MateriView.tsx` (472 baris) + `PaketMateriTab.tsx` (717 baris)
**Akses:** Admin & Penguji
**Tujuan:** Kelola materi hafalan (mufrodat/tarkib) — bisa sebagai paket per pekan/tema atau materi lepas.

### 3.1 Tab "Paket Materi"

**Grid kartu paket:**
- Thumbnail gambar (square 1:1)
- Nama paket, tema Arabic, badge pekan, level, jumlah item, tanggal rilis
- Filter by level

**Dialog Create/Edit Paket:**
- nama, level, pekan (int), tema (Arabic), deskripsi, imageUrl, tanggal rilis

**Dialog Detail Paket:**
- List items dengan media badges (Audio/Gambar/Video/Doc/Link/Social)
- Edit item (pensil) + Hapus item (trash) per item
- Form inline "Tambah Item": jenis, kategori, arabic, arti, contoh, imageUrl/audioUrl/videoUrl
- Tombol **"Import Batch via Script"** → buka Script Generator

**Dialog Edit Item:**
- Semua field (jenis, kategori, arabic, arti, contoh, imageUrl, audioUrl, videoUrl, documentUrl, externalLink)

**Script Generator Dialog:**
- Parser DSL dengan format:
  ```
  ## [mufrodat] / [tarkib] block
  arabic:
  arti:
  contoh:
  kategori:
  audio:
  gambar:
  video:
  ---
  ```
- Pisah antar item dengan `---`

### 3.2 Tab "Materi Lepas"

- Grid kartu materi (image preview square 1:1, Arabic, arti, contoh, media badges, audio player, external link)
- Filter by level, jenis (mufrodat/tarkib), kategori
- Search by arabic/arti/kategori
- Tombol berbahaya **"Hapus Semua Materi Lepas"** (hanya yang paketId=null)

### 3.3 Tab "Import Batch"

- CSV paste + pilih target level

### 3.4 Dialog Add/Edit Materi

| Field | Tipe | Keterangan |
|-------|------|------------|
| Jenis | Radio | mufrodat / tarkib |
| Marhalah | Dropdown | Level 1/2/3 |
| Arabic | Textarea RTL | Font Amiri |
| Arti | Text | Indonesian |
| Kategori | Text | Bebas |
| Contoh | Textarea | Kalimat contoh |
| **Media** | | |
| Gambar | FileUpload | Upload ke `/api/upload` |
| Video | FileUpload | mp4 / YouTube URL |
| Audio | FileUpload | mp3 |
| Document | FileUpload | PDF |
| External Link | URL | Untuk referensi luar |
| Social Embed | JSON | Embed social media |
| Tanggal Rilis | Date | null = draft (tidak visible ke mhs) |

---

## 4. Sesi Tes (Ujian)

**Lokasi file:** `src/components/views/SesiView.tsx` (1708 baris)
**Akses:** Admin & Penguji
**Tujuan:** Kelola sesi ujian + buat soal (3 tipe: isian, mcq, sambung).

### 4.1 List View

- Grid kartu sesi: nama, level, mode, durasi, jumlah soal, jumlah hasil, badge acak, badge jumlahSoalPerMahasiswa, tanggal mulai
- Tombol Edit + Hapus per sesi
- Tombol **"Buat Sesi Tes"**

### 4.2 Dialog Create/Edit Sesi

| Field | Tipe | Keterangan |
|-------|------|------------|
| Nama sesi | Text | Wajib |
| Level | Dropdown | Marhalah 1/2/3 |
| Mode | Radio | online (auto-koreksi) / offline (penguji input) / hybrid |
| Durasi | Number | Menit (default 30) |
| **Waktu Pelaksanaan** | | |
| Tanggal | Date | Tanggal ujian |
| Jam Mulai | Time | HH:MM |
| Jam Selesai | Time | HH:MM (untuk deadline) |
| **Pengaturan Acak (Anti-Contek)** | | |
| `acakUrutan` | Switch | Acak urutan soal per mahasiswa |
| `jumlahSoalPerMahasiswa` | Number | Subset random per mhs (kosong = semua soal) |
| `gunakanFase` | Switch | Acak per fase (1→2→3) |
| `aktif` | Switch | Status sesi |

### 4.3 Detail Sesi View (5 Sub-Tabs)

#### 4.3.1 Sub-Tab "Daftar Soal"

- List soal dengan badges: jenis, tipeSkor, bobot, fase, kategori, materi.jenis
- Per-soal actions: Edit (pensil), Copy (duplicate), Export Script (download .txt), Delete
- Audio player inline (preview admin)

#### 4.3.2 Sub-Tab "Tambah Manual" — Soal Builder

- **Jenis**: isian / mcq / sambung
- **Materi** (optional, dropdown dari level's materi)
- **Pertanyaan** (Textarea, font Amiri, RTL auto)
- **MCQ mode**:
  - List opsi dengan radio untuk jawaban benar
  - Tombol "+ Tambah opsi"
  - Per-opsi image URL field
  - Hapus opsi (min 2)
- **Sambung mode**:
  - Pairs list (A Arabic RTL ↔ B arti)
  - Tombol "+ Tambah pasangan"
  - Hapus pair (min 1)
- **Isian mode**: single jawaban benar (Arabic RTL)
- **Bobot** (Float, step 0.5)
- **Fase & Kategori** (optional, panel violet)
- **Media Soal** (panel biru):
  - FileUpload Gambar/Video/Audio
  - Embed URL (iframe)
  - Live preview
- **`isAudio` toggle** (panel amber) — enables TTS Arabic untuk `pertanyaanArabic` (max 2x play anti-cheat)

#### 4.3.3 Sub-Tab "Script Generator"

- Textarea dengan format help + tombol "Generate Soal dari Script"
- Format DSL:
  ```
  ## N. [isian|mcq|sambung] blocks
  jawaban:
  alt:
  ar:
  audio:
  gambar:
  video:
  embed:
  fase:
  kategori:
  bobot:
  isAudio:
  ```
- MCQ opsi: markdown list `- [+] benar` / `- salah`
- Sambung pairs: `(Na) arabic` / `(Nb) arti`
- Sambung extras: `(extra) text` untuk distractor
- Per-opsi/pair media fields: `gambar:`, `audio:`
- Result panel: created count + error list (max 10 shown)

#### 4.3.4 Sub-Tab "Hasil"

- Tabel: Mahasiswa, Kamar, Status, Skor, Benar/Total, Selesai
- Tombol **"Salin Nama Belum Kerja"** → copy list "Nama (Kamar), ..." ke clipboard atau download .txt

#### 4.3.5 Sub-Tab "Peserta"

- Checkbox "Izinkan semua mahasiswa"
- Tombol **"Centang yang Belum Ikut"** (auto-select mhs tanpa hasil)
- Tombol cepat "Centang Semua" / "Kosongkan"
- Search by nama/NIM
- Tabel: checkbox, NIM, Nama, Kamar, Status (Sudah/Belum)
- Tombol "Simpan Peserta" (simpan pesertaJson array of NIMs)

### 4.4 Edit Soal Dialog

- Sama seperti Tambah Manual, dengan `opsiImages` dan `pairs` yang di-restore dari JSON

### 4.5 Preview Tes Mode

- Admin view soal seperti mahasiswa (jawaban benar hidden, no submit)

### 4.6 Badges & Indikator

- 📅 Tanggal + ⏰ Jam mulai/selesai (di detail header)
- 🔄 Shuffle icon untuk `acakUrutan`
- 🎯 Gold badge untuk `jumlahSoalPerMahasiswa`

---

## 5. Hasil & Analisis

**Lokasi file:** `src/components/views/HasilView.tsx` (688 baris)
**Akses:** Admin & Penguji
**Tujuan:** Lihat hasil ujian + analisis item + override nilai manual.

### 5.1 Header

- Sesi picker (dropdown)
- Tombol kanan: **"Tambah Hasil Ujian"** (manual), **"Export CSV"**, **"Print"**

### 5.2 Tab "Semua Hasil"

- Tabel: NIM, Nama, Kamar, Status, Skor (with grade badge + Arabic grade + "override" tag if manualGrade set), Benar/Total, Catatan, Selesai, Aksi (Edit Nilai)
- Search by nama/NIM
- Filter buttons: Semua / Submitted / Graded / Ongoing / Tidak Ikut (with counts)
- Sort: kamar.nama asc, lalu skor desc
- Include mhs yang TIDAK ikut dengan status `tidak_ikut` (badge abu-abu)

### 5.3 Tab "Per Materi" (Item Analysis)

- Vertical BarChart: akurasi % per soal
- Tabel: #, Arabic, pertanyaan, benar, total, akurasi, badge tingkat (Mudah/Sedang/Sulit)
- Tingkat akurasi:
  - Mudah: ≥80%
  - Sedang: 60-79%
  - Sulit: <60%

### 5.4 Tab "Cross-Tab (Kamar × Materi)"

- Heatmap table: Kamar (rows) × Soal (columns)
- Color-coded cell:
  - 🟢 Hijau: ≥80%
  - 🟡 Amber: 60-79%
  - 🔴 Merah: <60%

### 5.5 Dialog Edit Nilai (Manual Grade Override)

- Info mahasiswa (nama, NIM, kamar, status, skor tes)
- **Nilai Manual** (0-100, step 0.1) — kosong = remove override
- **Keterangan** (Textarea — "Mis: tidak ikut karena sakit, dispensasi, terlambat")

### 5.6 Dialog Tambah Hasil Ujian Manual

- NIM input (auto-lookup mahasiswa by NIM, tampilkan nama + kamar + isKetuaKamar)
- Nilai (0-100)
- Waktu Selesai (datetime-local)
- Catatan
- **Use case:** mhs tidak ikut tes tapi admin kasih nilai (dispensasi/sakit)

---

## 6. Kegiatan Kamar

**Lokasi file:** `src/components/views/KegiatanView.tsx` (414 baris)
**Akses:** Admin & Penguji
**Tujuan:** Monitoring kegiatan harian & hafalan per kamar.

### 6.1 Filter Bar

- Date picker
- Lantai dropdown: Semua / Lt 02 / Lt 03 / Lt 04
- Tombol **"Salin Evaluasi Keseluruhan"** (copy all kamars ke format WhatsApp)

### 6.2 Kamar Cards Grid

Per kartu kamar:
- **Header**: nama kamar + tombol copy/detail
- **Kegiatan section** (Calendar icon)
- **Hafalan summary** (BookOpen icon): persentase + "X dari Y mufrodat (Z di antaranya jumlah)"
- **Anggota count**

### 6.3 Detail Kamar Dialog

- Kegiatan hari ini (with `inputBy` nama ketua)
- Anggota & Hafalan list: nama, ketua badge, NIM, paham/total, "X di antaranya jumlah" subset
- Tombol **"Salin Evaluasi"** (per kamar, format WhatsApp)

### 6.4 Bundle Endpoint

- 1 fetch untuk semua kamars + kegiatan + hafalan + anggota (replaces 50 N+1 fetches)
- Endpoint: `/api/kegiatan?action=summary&date=&lantai=&paketIds=`

---

## 7. Evaluasi Per Mahasiswa

**Lokasi file:** `src/components/views/PerMahasiswaView.tsx` (219 baris)
**Akses:** Admin & Penguji
**Tujuan:** Profil individu mahasiswa + tren performa.

### 7.1 Left Panel

- Mahasiswa picker (search by nama/NIM)
- List dengan NIM badge + nama + kamar

### 7.2 Right Panel

- **Mahasiswa card**: nama, NIM badge, kamar, avg score dengan grade badge + Arabic
- **3 stat tiles**: Total Sesi, Total Benar, Total Soal
- **"Tren Skor per Sesi"** line chart (Recharts, skor% per sesi selesai date)
- **"Riwayat Detail"** tabel: Sesi, Selesai, Status, Skor+grade Arabic, Benar/Total
- Tombol **Export PDF** (window.print())

---

## 8. Pengaturan

**Lokasi file:** `src/components/views/PengaturanView.tsx` (148 baris)
**Akses:** Admin & Penguji

### 8.1 Informasi Akun Card

- Nama, Username, Role badge "Admin"

### 8.2 Form Ubah Password

| Field | Tipe | Validasi |
|-------|------|----------|
| Password Lama | Password | Required |
| Password Baru | Password | Min 6 karakter |
| Konfirmasi Password Baru | Password | Must match Password Baru |

### 8.3 Bantuan Card

- Info text tentang cookie session, password reset, mahasiswa NIM login

---

# PORTAL MAHASISWA

## 9. Login & PWA Install

**Lokasi file:** `src/components/views/LoginView.tsx` (400 baris)
**Akses:** Public (unauthenticated)

### 9.1 Two Tabs

- **Admin login form**: Username + Password → `/api/auth?action=login-penguji`
- **Mahasiswa login form**:
  - NIM (10-digit, numeric only, auto-lookup via `/api/mahasiswa?lookup-by-nim=` dengan debounce 300ms)
  - Status indicator: ✅ found (green + name shown) / ❌ not found (red "Afwan NIM salah") / spinner
  - Password (tanggal lahir DDMMYYYY, 8-digit numeric)

### 9.2 Fitur Tambahan

- **Remember NIM** di localStorage (`mla_last_nim`)
- **PWA install prompt** (after 3s, if not dismissed): "Izinkan & Pasang" triggers `beforeinstallprompt` atau tampilkan iOS instructions, request notification permission
- **Fullscreen toggle** (top-right button)
- **Branding**: IAI STIBA Makassar logo, navy gradient orbs, Arabic calligraphy

---

## 10. Tes (Ujian)

**Lokasi file:** `src/components/views/UjianView.tsx` (1057 baris, includes `MatchingQuestion` + `SambungCableGame` components)
**Akses:** Mahasiswa
**Tujuan:** Interface ujian dengan anti-cheat, auto-submit, persistence.

### 10.1 Available Tes List

- Filter by date: Hari Ini / Kemarin / 7 Hari / Semua (button group)
- Per-sesi card: nama, level, durasi, soal count, jam selesai (red ⏰), skor if done, status badge (Aktif/Selesai/Terkunci)
- 3 action buttons per card:
  - **Mulai/Lanjut** (Play icon) — start or resume ujian
  - **Share WA** (Share2 icon) — disabled if not done; opens wa.me dengan pesan terformat
  - **Copy hasil** (Copy icon) — disabled if not done; copy format WA ke clipboard

### 10.2 Active Ujian UI

- **Header**: back button "← Keluar" + sesi nama + level + durasi + "Kumpulkan" button
- **Progress bar**: current soal / total, %
- **Current soal card**
- **Quick navigation grid** (6-10 cols, scrollable): shows answered vs unanswered vs current
- **Prev/Next buttons**

### 10.3 Soal Rendering (per jenis)

#### 10.3.1 Isian

- Arabic RTL input (font Amiri, dir="rtl", text-2xl)
- Single-line input

#### 10.3.2 MCQ

- RadioGroup dengan opsi list (text Arabic)
- Per-opsi image (square 1:1)
- Per-opsi audio player
- Single selection only

#### 10.3.3 Sambung (Cable Game)

**Component:** `<SambungCableGame>`
- SVG bezier cable drag-and-drop
- Kolom A (left) ↔ Kolom B (right)
- Drag from port to port (bidirectional: A→B atau B→A)
- Click cable to disconnect
- Support `extras` distractors (B yang tidak match)
- COLORS array (8 colors) untuk kabel
- Hover scale 1.05, drag scale 1.5
- Dimmed opacity 0.35 ketika connected
- **Partial credit scoring**: correctPairs / totalPairs × bobot (no negative marking)

#### 10.3.4 Matching (Legacy)

**Component:** `<MatchingQuestion>`
- Select dropdown per pair

### 10.4 Media Display (semua jenis)

- **Image** (square 1:1 crop)
- **Video** (YouTube embed via iframe OR direct mp4 via `<video>`)
- **Audio** (mp3 player)
- **Embed URL** (iframe)
- **TTS Arabic audio**: `playArabicTTS(text)` — uses Web Speech API, max 2x play anti-cheat, fallback to text if voice unavailable

### 10.5 Anti-Cheat (silent, no overlay)

- Block Ctrl+C/A/S/P/U/X, F12, Ctrl+Shift+I/J/C/K
- Block PrintScreen (clear clipboard)
- Block right-click context menu
- Block copy/cut events
- Disable text selection in `.anti-cheat-zone` (except inputs/textareas)
- `visibilitychange` → if hidden during active tes: set sessionStorage flag + POST `/api/auth?action=logout` (keepalive) → on visible again, reload page
- Server-side: API strips `jawabanBenar` dan `jawabanAlternatif` dari soal detail response

### 10.6 Auto-save jawaban

- Key: `ujian-jawaban-{sesiId}-{mahasiswaId}`
- Auto-save on every `setJawabanForSoal`
- Restore on `startUjian` (fallback to `hasil.detail` dari server jika localStorage empty)
- Clear on successful submit

### 10.7 Submit Logic

- Confirm dialog "Kumpulkan jawaban?"
- POST `/api/ujian?action=submit` dengan jawaban array
- Server: bulk insert `DetailHasil` (1 query, not N)
- Compute skor: (sum benar bobot / total bobot) × 100
- Set `jumlahSoal` dari subset (bukan total)
- Unanswered soal = 0 skor
- **Sambung partial credit**: correctPairs / totalPairs × bobot
- **Deadline check**: jika `jamSelesai` passed → block submit, auto-mark as submitted with skor 0 (catatan "Auto-submitted: deadline passed")

### 10.8 Done View (after submit)

- `<MumtazCelebration>` confetti animation jika grade A (≥90%)
- Score display (big number + Arabic grade + letter)
- Benar/total soal
- Tombol **"Share Hasil ke WhatsApp"** (opens wa.me via `formatHasilUjianMessage`)
- Tombol **"Kembali ke Daftar Tes"**

### 10.9 Auto-submit Ongoing Hasil

- Triggered on `/api/ujian?action=available` GET
- Auto-submits any `ongoing` hasil whose sesi deadline passed
- Skor computed dari existing detail + unanswered=0

---

## 11. Materi Mahasiswa

**Lokasi file:** `src/components/views/MateriMahasiswaView.tsx` (258 baris)
**Akses:** Mahasiswa
**Tujuan:** Browse materi yang sudah dirilis (paket & lepas).

### 11.1 Filter

- By date: Hari Ini / Kemarin / 7 Hari / Semua (button group)

### 11.2 Paket Materi Section

- Card dengan package badge, pekan badge, "Baru Hari Ini" badge (if today)
- Nama, tema Arabic, deskripsi, item count, tanggal rilis, image thumbnail (square 1:1)
- Tombol **"Buka (N item)"** / **"Tutup"** toggle untuk expand items
- Items list: jenis badge, kategori, Arabic, arti, contoh, image square, audio player, video YouTube embed

### 11.3 Materi Lepas Section

- Card dengan jenis badge, kategori, "Baru Hari Ini" badge
- Arabic, arti, contoh, image square, audio player, tanggal rilis

---

## 12. Progres Saya

**Lokasi file:** `src/components/views/ProgressView.tsx` (146 baris)
**Akses:** Mahasiswa
**Tujuan:** Tracking progres belajar mhs.

### 12.1 Stat Cards (4 kartu)

- **Total Sesi** — jumlah sesi yang diikuti
- **Rata-rata Skor** — avg skor semua hasil
- **Total Benar/Total Soal** — overall accuracy
- **Kamar** — dengan Ketua/Anggota sub

### 12.2 Tren Skor Saya

- Line chart (Recharts, skor% per sesi selesai date)

### 12.3 Materi yang Perlu Diperbaiki

- List sorted weakest first (max 10)
- Per-item: accuracy badge, Arabic, arti, benar/total

### 12.4 Riwayat Detail

- Tabel: Sesi, Selesai, Status badge, Skor+grade Arabic, Benar/Total

---

## 13. Kamar Saya (Ketua Kamar)

**Lokasi file:** `src/components/views/KetuaKamarView.tsx` (729 baris)
**Akses:** Mahasiswa dengan `isKetuaKamar=true`
**Tujuan:** Ketua kamar monitoring anggota & hafalan.

### 13.1 Header

- "Monitoring Kamar {kamar.nama}"
- 2 tombol:
  - **"Kegiatan"** (amber, opens kegiatan dialog)
  - **"Salin Evaluasi Kamar"** (emerald, copies WhatsApp-formatted evaluasi)

### 13.2 Kegiatan Dialog

- Tag buttons: "Hafal mufrodat", "Murajaah dars", "Musyawarah", "Nobar", "Absensi kamar"
- Custom kegiatan input (Enter to add)
- Selected kegiatan list (chips dengan × remove)
- Tombol "Selesai" → POST `/api/kegiatan` (upsert by kamarId+today)

### 13.3 Tab "Anggota"

- Date picker (filter hasil tes per tanggal)
- Per-anggota row:
  - Login status dot (green/gray)
  - Nama, ketua badge
  - Login info: "Login hari ini · HH:MM" atau "Belum login hari ini"
  - Hafalan summary: X/total hafal, Z jumlah subset
  - Rata-rata skor: sum(skorTotal per sesi diikuti) / totalSesiCount
  - Sub: "rata-rata · X/Y sesi" (sesi yang sudah lewat tanggalMulai)
  - Sesi tidak diikuti = 0

### 13.4 Tab "Hafalan"

- Monitoring grid (anggota × materi)
- Refresh button
- Filter paket dropdown (tidak ada "Semua Paket" — wajib pick specific paket)
- Grid table: rows = anggota, columns = materi (up to 500)
- Per-cell button: status cycle:
  - **belum** (○, gray)
  - **hafal** (H, blue)
  - **jumlah** (J, emerald)
  - Title: "arti — status: X (oleh Y)"
- Footer row: **"Hafal Semua →"** per kolom — sets all `belum` anggota to `hafal` (parallel POSTs)

### 13.5 Salin Evaluasi Semua (WhatsApp format)

- Header: 📋 Monitoring Kamar, Kamar, Ketua, Tanggal
- Per-anggota:
  - Nama
  - Rata-rata skor: X.X%
  - Hafalan Mufrodat: X/Y
- 🎯 Kegiatan Kamar: list
- Signature: Tim Pengembangan Bahasa Ma'had Lughah

---

# SISTEM & FITUR LINTAS PORTAL

## 14. Anti-Cheat System

**Lokasi:** `src/hooks/use-anti-cheat.ts`
**Aktif:** Saat ujian sedang berlangsung (active tes)

### 14.1 Keyboard Shortcuts Blocked

- Ctrl+C/A/S/P/U/X
- F12
- Ctrl+Shift+I/J/C/K (devtools)

### 14.2 Browser Features Blocked

- PrintScreen (clear clipboard)
- Right-click context menu
- Copy event
- Cut event
- Text selection in `.anti-cheat-zone` (kecuali inputs/textareas)

### 14.3 Visibility Change Detection

- Jika tab di-hidden selama active tes:
  1. Set sessionStorage flag `anti-cheat-logout`
  2. POST `/api/auth?action=logout` (keepalive)
- Saat tab kembali visible:
  - Reload page (auto-logout via refresh detection)

### 14.4 Server-Side Anti-Cheat

- API `/api/ujian?action=detail` **menghapus** field:
  - `jawabanBenar`
  - `jawabanAlternatif`
- Mhs tidak bisa lihat kunci jawaban via network tab

---

## 15. TTS Arabic (Text-to-Speech)

**Lokasi:** `src/hooks/use-tts.ts`
**Tujuan:** Mahasiswa dengarkan pengucapan Arabic native.

### 15.1 Implementasi

- Web Speech API (browser native, no API key)
- Filter voices dengan `lang.startsWith('ar')`
- `speak(text, opts?)`:
  - Cancels ongoing speech
  - Rate 0.75 (lebih lambat untuk learning)
  - Pitch 1
  - Lang `ar-SA` (Saudi Arabic)
- `stop()` — stop ongoing speech
- `resetCount(max?)` — reset play count

### 15.2 Anti-Cheat Limit

- **Max 2x play per soal** (mencegah mahasiswa dengar berulang)
- Setelah 2x, tombol play disabled

### 15.3 Fallback

- Jika voice Arabic unavailable → fallback ke text display
- Tidak crash kalau Web Speech API tidak didukung

---

## 16. Auto-Submit & Deadline System

**Lokasi:** `src/app/api/ujian/route.ts`

### 16.1 Auto-Submit Trigger

Triggered saat mhs GET `/api/ujian?action=available`:
- Cek semua `ongoing` HasilUjian milik mhs
- Kalau `jamSelesai` sesi passed → auto-submit
- Skor dihitung dari jawaban yang sudah disimpan + unanswered=0
- Catatan: "Auto-submitted: deadline passed"

### 16.2 Block pada Deadline

- `?action=start` → return 423 Locked kalau deadline passed
- `?action=submit` → block + auto-mark sebagai submitted dengan skor 0

### 16.3 Retry Setelah Deadline

- `?action=retry` → buat HasilUjian baru (status ongoing)
- Catatan: "RETRY - tidak mempengaruhi nilai asli"
- Hanya available setelah deadline (untuk latihan)

---

## 17. Randomisasi Soal per Mahasiswa

**Lokasi:** `src/app/api/ujian/route.ts` — `?action=detail`

### 17.1 PRNG Seeded

- Seed: `${mahasiswaId}-${sesiId}` (deterministic per mhs+sesi)
- Setiap mhs dapat urutan soal yang berbeda tapi konsisten saat refresh

### 17.2 Konfigurasi Acak

| Setting | Efek |
|---------|------|
| `acakUrutan` | Acak urutan semua soal |
| `jumlahSoalPerMahasiswa` | Ambil subset random sebanyak N |
| `gunakanFase` | Acak within fase, lalu concatenate 1→2→3 |

### 17.3 Implementasi

- PRNG: deterministic Fisher-Yates shuffle
- Subset: slice after shuffle
- Fase: group by fase, shuffle each group, concat

---

## 18. localStorage Persistence

**Lokasi:** `src/components/views/UjianView.tsx`

### 18.1 Key Format

```
ujian-jawaban-{sesiId}-{mahasiswaId}
```

### 18.2 Behavior

- **Auto-save**: setiap `setJawabanForSoal` call
- **Restore**:
  1. Cek localStorage — kalau ada, restore
  2. Fallback ke `hasil.detail` dari server (jika mhs sudah mulai tapi localStorage kosong)
- **Clear**: setelah submit sukses

### 18.3 Use Case

- Mhs keluar dari ujian → kembali → jawaban tersimpan
- Mhs reload page → jawaban restore
- Mhs pindah device → jawaban tetap (sync via server `hasil.detail`)

---

## 19. Manual Grade Override

**Lokasi:** `src/app/api/hasil/route.ts` — `?action=set-manual-grade`

### 19.1 Field di Database

- `manualGrade` (Float, nullable) — kalau di-set, override skor tes
- `manualNote` (String, nullable) — keterangan admin

### 19.2 Use Case

- Mhs sakit → tidak ikut → admin kasih nilai dispensasi
- Mhs terlambat → admin input manual
- Mhs ada masalah → admin override

### 19.3 Behavior

- Kalau mhs belum ada HasilUjian → create record dengan status `tidak_ikut`
- Kalau mhs sudah ada HasilUjian → update field `manualGrade` + `manualNote`
- Tabel Semua Hasil menampilkan badge "override" kalau `manualGrade` set

### 19.4 Tambah Hasil Manual

- Endpoint: `?action=create-manual-hasil`
- Input: NIM, Nilai (0-100), Waktu Selesai, Catatan
- Auto-lookup mahasiswa by NIM (tampilkan nama + kamar + isKetuaKamar)

---

## 20. WhatsApp Share Integration

**Lokasi:** `src/lib/wa-share.ts`

### 20.1 Functions

- `buildWhatsAppUrl(text)` → `https://wa.me/?text=...` (URL-encoded)
- `openWhatsAppShare(text)` → window.open(wa.me)
- `formatHasilUjianMessage(...)` → format pesan hasil ujian
- `formatEvaluasiKamarMessage(...)` → format pesan evaluasi kamar

### 20.2 Use Cases

| Fitur | Format |
|-------|--------|
| **Share hasil ujian mhs** | "Saya sudah selesai ujian [nama], skor [X], grade [A/B/C/D/F]" |
| **Salin laporan ujian admin** | "📊 LAPORAN HASIL UJIAN..." dengan distribusi A-F + GHAIB |
| **Salin evaluasi kamar** | "📋 Monitoring Kamar [nama]..." dengan anggota, kegiatan, hafalan |
| **Salin evaluasi keseluruhan** | Semua kamar dalam 1 pesan |
| **Salin nama belum kerja** | List "Nama (Kamar), ..." untuk follow-up |

---

## 21. PWA (Progressive Web App)

### 21.1 Manifest

- `public/manifest.json`
- Name, short_name, start_url `/`
- Display: `browser` (bukan standalone)
- Theme color: `#1E2A78` (navy)
- Icons: 512×512

### 21.2 Install Prompt

**Lokasi:** `LoginView.tsx`
- Listen `beforeinstallprompt` event
- Tampilkan prompt setelah 3 detik (kalau belum di-dismiss)
- Tombol "Izinkan & Pasang":
  - Android/Desktop: trigger `beforeinstallprompt.prompt()`
  - iOS: tampilkan instructions (Share → Add to Home Screen)
- Request notification permission

### 21.3 Branding

- 4 IAI STIBA Makassar logos (putih/berwarna × indo/arab)
- Navy gradient background
- Arabic calligraphy decorative
- Gold orb accents

---

## 22. Cron Job Harian

**Lokasi:** `src/app/api/cron/daily-check/route.ts` (191 baris)
**Schedule:** `0 6 * * *` (06:00 UTC = 13:00 WIB) — via Vercel Cron
**Auth:** Bearer `CRON_SECRET`

### 22.1 Tugas Cron

#### A. Ketua Alerts

- Untuk setiap ketua kamar:
  - Find anggota belum login hari ini
  - Create `ketua_alert` notification ke ketua

#### B. Ujian Reminders

- Untuk sesi aktif dengan `jamMulai` hari ini:
- Create `ujian_reminder` broadcast di milestones:
  - 120 menit sebelum
  - 60 menit sebelum
  - 30 menit sebelum
- Dedup within 10 minutes

#### C. Materi Baru

- Untuk materi dengan `tanggalRilis` hari ini:
- Create `materi_baru` broadcast notification

---

## 23. Sistem Notifikasi

**Lokasi:** `src/app/api/notifications/route.ts` (82 baris)
**Akses:** Mahasiswa

### 23.1 Endpoints

- `GET ?mahasiswaId=` — list notif for mhs + broadcast (top 50)
- `GET ?action=unread-count&mahasiswaId=` — count unread
- `POST ?action=mark-read` — mark single notif as read
- `POST ?action=mark-all-read` — mark all mhs's notif as read

### 23.2 Type of Notifications

| Type | Trigger | Target |
|------|---------|--------|
| `motivasi` | Manual admin broadcast | All mhs |
| `ujian_reminder` | Cron (120/60/30 min before) | All peserta sesi |
| `materi_baru` | Cron (hari rilis) | All mhs |
| `reminder_login` | Cron (kalau belum login X hari) | Specific mhs |
| `ketua_alert` | Cron (anggota belum login) | Ketua kamar |

---

# LAMPIRAN

## Database Schema (Prisma Models)

**Lokasi:** `prisma/schema.prisma`

### Model List

| # | Model | Deskripsi | Key Fields |
|---|-------|-----------|------------|
| 1 | **User** | Akun admin/penguji | `username`, `password`, `role` (`penguji`\|`admin`) |
| 2 | **Kamar** | Kamar asrama | `nama` (format `08.LL.KK`), `gender`, `kapasitas` |
| 3 | **KegiatanKamar** | Log kegiatan harian per kamar | `kamarId`, `kegiatan` (CSV), `inputBy`, `tanggal` |
| 4 | **Level** | Marhalah (1, 2, 3) | `nomor`, `nama`, `deskripsi` |
| 5 | **Mahasiswa** | Akun santri | `nim` (10-digit), `nama`, `wa`, `tanggalLahir`, `isKetuaKamar` |
| 6 | **Materi** | Mufrodat/tarkib | `jenis`, `arabic`, `arti`, `contoh`, `kategori`, media fields, `tanggalRilis` |
| 7 | **PaketMateri** | Group materi per pekan/tema | `nama`, `tema`, `pekan`, `kategori`, `deskripsi`, `imageUrl`, `tanggalRilis` |
| 8 | **SesiUjian** | Sesi ujian | `nama`, `levelId`, `mode`, `durasiMenit`, `tanggalMulai`, `jamMulai`, `jamSelesai`, `acakUrutan`, `jumlahSoalPerMahasiswa`, `gunakanFase`, `pesertaJson`, `aktif` |
| 9 | **SoalUjian** | Soal dalam sesi | `sesiId`, `no`, `jenis`, `pertanyaan`, `opsiJson`, `jawabanBenar`, `jawabanAlternatif`, `bobot`, `tipeSkor`, `hint`, `fase`, `kategori`, media fields, `isAudio`, `pairsJson` |
| 10 | **HasilUjian** | Hasil ujian per (sesiId, mahasiswaId) | `mulai`, `selesai`, `status`, `skorTotal`, `jumlahBenar`, `jumlahSoal`, `catatan`, `manualGrade`, `manualNote` |
| 11 | **DetailHasil** | Jawaban per soal | `hasilId`, `soalId`, `jawaban`, `audioUrl`, `skor`, `benar`, `catatanPenguji`, `status` (`pending`\|`graded`), `gradedAt` |
| 12 | **LoginEvent** | Tracking login/logout/view | `mahasiswaId`, `type` (`login`\|`logout`\|`view_materi`), `materiId`, `timestamp` |
| 13 | **HafalanTracking** | Status hafalan per (mhs, materi) | `mahasiswaId`, `materiId`, `status` (`belum`\|`hafal`\|`bisa`\|`lancar`), `centangBy`, `catatan` |
| 14 | **Notification** | Notif per mhs atau broadcast | `mahasiswaId` (null=broadcast), `type`, `title`, `body`, `metadata` (JSON), `read` |

### Unique Constraints

- `User.username` (unique)
- `Kamar.nama` (unique)
- `Level.nomor` (unique)
- `Mahasiswa.nim` (unique, 10-digit)
- `HasilUjian` @@unique([sesiId, mahasiswaId])
- `HafalanTracking` @@unique([mahasiswaId, materiId])

### Enums (via String)

- `User.role`: `penguji` | `admin`
- `Kamar.gender`: `putra` (default) | `putri`
- `Materi.jenis`: `mufrodat` | `tarkib`
- `PaketMateri.kategori`: `mufrodat` | `tarkib` | `campuran`
- `SesiUjian.mode`: `online` | `offline` | `hybrid`
- `SoalUjian.jenis`: `isian` | `mcq` | `sambung` (legacy: `terjemahan`/`matching`/`audio`)
- `SoalUjian.tipeSkor`: `benar_salah` | `0_100` | `A_B_C_D`
- `HasilUjian.status`: `ongoing` | `submitted` | `graded` | `tidak_ikut`
- `HafalanTracking.status`: `belum` | `hafal` | `bisa` | `lancar` (UI uses `belum`\|`hafal`\|`jumlah`)
- `LoginEvent.type`: `login` | `logout` | `view_materi`
- `Notification.type`: `motivasi` | `ujian_reminder` | `materi_baru` | `reminder_login` | `ketua_alert`

---

## Daftar Lengkap API Routes

| # | Endpoint | Methods | Deskripsi |
|---|----------|---------|-----------|
| 1 | `/api/auth` | POST, GET | Login/logout/change-password/me |
| 2 | `/api/master` | GET, POST, DELETE | CRUD kamar & level |
| 3 | `/api/mahasiswa` | GET, POST, PATCH, DELETE | CRUD mahasiswa + lookup-by-nim |
| 4 | `/api/materi` | GET, POST, PATCH, DELETE | CRUD materi + delete-all-lepas |
| 5 | `/api/materi-mahasiswa` | GET | List materi untuk mhs (pakets + lepas) |
| 6 | `/api/paket-materi` | GET, POST, PATCH, DELETE | CRUD paket + generate-from-script |
| 7 | `/api/sesi` | GET, POST, PATCH, DELETE | CRUD sesi + add-soal + save-peserta + generate-from-script |
| 8 | `/api/ujian` | GET, POST | Mahasiswa-facing: available/detail/start/submit/evaluasi/retry/auto-submit |
| 9 | `/api/hasil` | GET, POST | Overview/by-kamar/by-materi/by-mahasiswa/cross-tab + set-manual-grade + create-manual-hasil |
| 10 | `/api/hafalan` | GET, POST | Get grid + upsert tracking |
| 11 | `/api/kegiatan` | GET, POST | Today's kegiatan + summary bundle |
| 12 | `/api/tracking` | GET, POST | Login tracking + view-materi tracking |
| 13 | `/api/notifications` | GET, POST | List notif + mark-read + unread-count |
| 14 | `/api/import` | POST, GET | SSE stream import: mahasiswa/materi/soal + reset + templates |
| 15 | `/api/cron/daily-check` | GET | Cron 06:00 UTC — ketua alerts, ujian reminders, materi baru |
| 16 | `/api` | GET | Health check (`{message: "Hello, world!"}`) |

---

## Skor & Grading System

### Bobot & Tipe Skor

Setiap soal punya 2 field:
- `bobot` (Float, default 1) — bobot soal
- `tipeSkor` (`benar_salah` | `0_100` | `A_B_C_D`)

### Komputasi Skor

```
skorTotal = (sum benar bobot / sum total bobot) × 100
```

- Unanswered soal = 0 skor
- Sambung partial credit: `correctPairs / totalPairs × bobot`
  - `benar = true` only if all pairs correct (untuk `jumlahBenar` count)

### Grade Thresholds

| Grade | Arabic | Indonesian | Range | Color |
|-------|--------|------------|-------|-------|
| **A** | ممتاز | Mumtaz | ≥90% | Hijau |
| **B** | جيد جداً | Jayy Jiddan | 80-89% | Biru |
| **C** | جيد | Jayy | 65-79% | Amber |
| **D** | مقبول | Maqbul | 50-64% | Oranye |
| **F** | ضعيف | Da'if | <50% | Merah |
| **GHAIB** | غائب | Ghaib | Tidak ikut | Abu-abu |

### Mumtaz Celebration

- Jika skor ≥90% (grade A) → confetti animation (30 pieces CSS)
- Tampil di Done View setelah submit

---

## Tipe Soal yang Didukung

### 1. Isian (Fill-in-the-blank)

- Single-line Arabic RTL input
- Font Amiri, dir="rtl", text-2xl
- Jawaban benar + `jawabanAlternatif` (array)
- Bobot default 1

### 2. MCQ (Multiple Choice)

- RadioGroup dengan opsi list
- Per-opsi image (square 1:1) — URL field
- Per-opsi audio player
- Min 2 opsi
- Single selection only
- Jawaban benar = 1 opsi

### 3. Sambung (Cable Matching)

**Component:** `<SambungCableGame>` di `UjianView.tsx`
- SVG bezier cable drag-and-drop
- Kolom A (left) ↔ Kolom B (right)
- Bidirectional drag: A→B dan B→A
- Click cable untuk disconnect
- **Support extras (distractors)**: B yang tidak match
- COLORS array (8 colors) untuk kabel
- White background, no frame, hanya text + colored dots
- 3px SVG bezier curves
- Hover scale 1.05, drag scale 1.5
- Dimmed opacity 0.35 when connected
- Size="sm" untuk compact view
- **Partial credit scoring**: correctPairs / totalPairs × bobot
- Anti-bug: `key={soal.id}` untuk fix `shuffledB` bug

### 4. Matching (Legacy)

- Select dropdown per pair
- Tidak digunakan di soal baru
- Backward compatibility only

### 5. Terjemahan & Audio (Legacy)

- DB-supported tapi tidak digunakan di UI baru
- Backward compatibility

---

## Catatan Khusus

### Yang TIDAK Ada

- ❌ Tidak ada middleware.ts (auth di-handle di `page.tsx` useEffect + `/api/auth?action=me`)
- ❌ Tidak ada role middleware admin-only (semua admin view bergantung session check)
- ❌ Tidak ada upload file endpoint (`/api/upload` tidak ada — FileUpload component fallback ke URL paste)
- ❌ Tidak ada rich text editor aktif (TipTap ter-install tapi tidak digunakan di views)
- ❌ Tidak ada real-time WebSocket (semua via HTTP polling/SSE)

### Yang Aktif

- ✅ Cookie-based session (no JWT)
- ✅ Lazy-loaded views (`next/dynamic`)
- ✅ PWA manifest + install prompt
- ✅ Cron daily at 06:00 UTC
- ✅ Bundle endpoints (N+1 query fix)
- ✅ SSE for import progress
- ✅ WhatsApp deep-link share
- ✅ Print PDF via window.print()
- ✅ CSV export

---

**Dokumen versi:** 1.0
**Last updated:** Oktober 2026
**Sumber:** Eksplorasi kode lengkap dari repository `/home/z/my-project/`
