# Panduan Deploy Lengkap: Next.js + Prisma + Supabase (Gratis)

> Dokumen ini dapat digunakan oleh siapa saja yang ingin mendeploy aplikasi sejenis (Next.js + Prisma + Supabase). Semua nilai dalam kurung siku `[...]` adalah placeholder — ganti dengan nilai Anda sendiri.
>
> **Contoh placeholder:**
> - `[NAMA-PROJECT]` → mis. `mahad-lughah` atau `ujian-arab` atau `aplikasi-ujiAN`
> - `[GITHUB-USERNAME]` → username GitHub Anda
> - `[DOMAIN-ANDA]` → mis. `ujian.sekolah.ac.id`
> - `[PASSWORD-SUPABASE]` → password database Supabase yang Anda buat

---

## Daftar Isi

1. [Arsitektur & Overview](#1-arsitektur--overview)
2. [Akun yang Dibutuhkan](#2-akun-yang-dibutuhkan)
3. [Persiapan Local Environment](#3-persiapan-local-environment)
4. [LANGKAH 1: Setup Supabase (Database)](#langkah-1-setup-supabase-database)
5. [LANGKAH 2: Konfigurasi Prisma](#langkah-2-konfigurasi-prisma)
6. [LANGKAH 3: Environment Variables](#langkah-3-environment-variables)
7. [LANGKAH 4: Setup GitHub & Push Kode](#langkah-4-setup-github--push-kode)
8. [LANGKAH 5: Deploy ke Vercel](#langkah-5-deploy-ke-vercel)
9. [LANGKAH 6: Setup Database di Produksi](#langkah-6-setup-database-di-produksi)
10. [LANGKAH 7: Test & Verifikasi](#langkah-7-test--verifikasi)
11. [Custom Domain (Opsional)](#custom-domain-opsional)
12. [Deploy via Termux (HP Android)](#deploy-via-termux-hp-android)
13. [Backup & Restore Database](#backup--restore-database)
14. [Limit Free Tier](#limit-free-tier)
15. [Troubleshooting](#troubleshooting)
16. [Best Practices Keamanan](#best-practices-keamanan)

---

## 1. Arsitektur & Overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Browser    │───▶│    Vercel    │───▶│   Supabase   │
│  (Mahasiswa) │    │  (Next.js)   │    │ (PostgreSQL) │
└──────────────┘    └──────────────┘    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │   GitHub     │
                    │ (Source Code)│
                    └──────────────┘
```

**Komponen utama:**
- **GitHub** → menyimpan source code (private repo direkomendasikan)
- **Vercel** → hosting aplikasi Next.js (auto-deploy dari GitHub)
- **Supabase** → database PostgreSQL managed

**Cara kerja deploy:**
1. Anda push kode ke GitHub
2. Vercel otomatis detect perubahan → build & deploy ulang (~2-3 menit)
3. Supabase tetap menyimpan data (persistent, tidak terpengaruh deploy)

**Biaya:** Rp 0/bulan (free tier, cukup untuk 200 mahasiswa aktif)

---

## 2. Akun yang Dibutuhkan

Buat 3 akun berikut (semua gratis):

| Akun | URL | Untuk | Login dengan |
|------|-----|-------|--------------|
| **GitHub** | [github.com](https://github.com) | Source code | Email/password |
| **Vercel** | [vercel.com](https://vercel.com) | Hosting web app | Login pakai GitHub (lebih mudah) |
| **Supabase** | [supabase.com](https://supabase.com) | Database PostgreSQL | Login pakai GitHub (lebih mudah) |

> 💡 **Tips:** Sign up Vercel & Supabase pakai "Continue with GitHub" — otomatis terhubung, tidak perlu ingat password baru.

---

## 3. Persiapan Local Environment

### 3.1 Install Node.js (v20+)

**Windows/Mac:** Download dari [nodejs.org](https://nodejs.org) (pilih LTS)

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Termux (Android):**
```bash
pkg install nodejs
```

Verifikasi:
```bash
node -v    # harus v20.x atau lebih baru
npm -v     # npm 10.x+
```

### 3.2 Install Git

- **Windows:** Download dari [git-scm.com](https://git-scm.com)
- **Mac:** `brew install git` atau install Xcode Command Line Tools
- **Linux:** `sudo apt install git`
- **Termux:** `pkg install git`

Verifikasi:
```bash
git --version
```

### 3.3 Dapatkan Source Code

Pilih salah satu cara:

**Cara A — Clone dari repo existing (jika Anda di-invite ke repo):**
```bash
git clone https://github.com/[GITHUB-USERNAME]/[NAMA-PROJECT].git
cd [NAMA-PROJECT]
```

**Cara B — Copy folder project (jika diberi zip/file):**
```bash
# Extract ke folder, lalu:
cd [NAMA-PROJECT]
npm install
```

### 3.4 Install Dependencies

```bash
cd [NAMA-PROJECT]
npm install
```

Tunggu 2-5 menit (tergantung koneksi & device).

---

## LANGKAH 1: Setup Supabase (Database)

### 1.1 Buat Project Baru

1. Login ke [supabase.com](https://supabase.com)
2. Klik **New Project**
3. Isi form:
   - **Organization:** buat baru (mis. `[ORG-ANDA]`) atau pilih existing
   - **Name:** `[NAMA-PROJECT]` (mis. `mahad-lughah`)
   - **Database Password:** Buat password KUAT (gunakan password manager)
     - ⚠️ **SANGAT PENTING:** Catat password ini di tempat aman (password manager, bukan note HP). Supabase tidak bisa reset password database tanpa recreate project.
   - **Region:** `Southeast Asia (Singapore)` — paling dekat ke Indonesia
   - **Plan:** Free
4. Klik **Create new project**
5. Tunggu 2-3 menit sampai project siap

### 1.2 Ambil Connection String

1. Di dashboard Supabase, buka **Settings** (ikon gear di kiri bawah)
2. Pilih **Database**
3. Scroll ke **Connection string** → pilih tab **URI**
4. Copy connection string, format-nya:
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   Atau format lama (direct connection):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```

### 1.3 Catat Informasi Berikut

Simpan di password manager / catatan aman:
- ✅ **Project name:** `[NAMA-PROJECT]`
- ✅ **Project ref:** `[PROJECT_REF]` (12 karakter, ada di URL dashboard)
- ✅ **Database password:** `[PASSWORD-SUPABASE]`
- ✅ **Connection string:** `[DATABASE_URL]` lengkap

---

## LANGKAH 2: Konfigurasi Prisma

### 2.1 Edit `prisma/schema.prisma`

Buka file `prisma/schema.prisma` di editor (VS Code, Sublime, atau nano).

Cari bagian `datasource`:

```prisma
// UBAH DARI (jika masih SQLite):
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// MENJADI:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> ⚠️ **Hanya ubah `sqlite` → `postgresql`.** Bagian lain dari `schema.prisma` tidak perlu diubah.

### 2.2 Generate Prisma Client

```bash
npx prisma generate
```

Output yang diharapkan:
```
✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client
```

---

## LANGKAH 3: Environment Variables

### 3.1 Buat File `.env`

Di root folder project, buat file `.env` (jika belum ada):

```bash
# Di terminal:
cp .env.example .env      # kalau ada template
# ATAU buat baru:
touch .env
```

Edit isi `.env`:

```env
# Database connection (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[PASSWORD-SUPABASE]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Next.js secret (generate random string)
NEXTAUTH_SECRET="generate-random-string-32-chars"
# Generate dengan: openssl rand -base64 32

# App config
NEXT_PUBLIC_APP_NAME="[NAMA-PROJECT]"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> ⚠️ **PENTING:** Jangan ada spasi dalam value, jangan ada quote di dalam quote, dan pastikan pakai quote ganda (`"`) di sekitar URL.

### 3.2 Test Koneksi Database

```bash
npx prisma db push
```

Output sukses:
```
🚀  Your database is now in sync with your Prisma schema.
```

Kalau error "Can't reach database server":
- Cek koneksi internet
- Cek `DATABASE_URL` benar (password, project ref)
- Cek Supabase project status (harus "Active")

### 3.3 Setup Admin User

Setelah tabel dibuat, buat admin pertama:

```bash
npx tsx scripts/create_admin.ts
# ATAU manual:
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.user.create({
  data: {
    username: 'admin',
    password: 'admin123',  // GANTI password ini!
    role: 'admin',
    name: 'Administrator'
  }
}).then(() => {
  console.log('✅ Admin user created');
  process.exit(0);
}).catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
"
```

> ⚠️ **WAJIB ganti password admin** setelah login pertama! Password default `admin123` hanya untuk testing.

---

## LANGKAH 4: Setup GitHub & Push Kode

### 4.1 Buat Repository di GitHub

1. Login ke [github.com](https://github.com)
2. Klik tombol **+** di kanan atas → **New repository**
3. Isi:
   - **Repository name:** `[NAMA-PROJECT]` (mis. `mahad-lughah`)
   - **Description:** (opsional) `Aplikasi Ujian Bahasa Arab`
   - **Visibility:**
     - ✅ **Private** (direkomendasikan) — kode & potensi data sensitif tidak terlihat publik
     - ❌ Public — kode bisa dilihat semua orang (OK kalau tidak ada data sensitif)
   - **Initialize with:** ❌ Jangan centang "Add README", "Add .gitignore", "Choose license" (sudah ada di folder project)
4. Klik **Create repository**

### 4.2 Cara Publish GitHub (Pilihan)

#### OPSI A: HTTPS (paling mudah, cocok untuk pemula)

```bash
# Di folder project:
git init
git add .
git commit -m "Initial commit - First deploy"
git branch -M main
git remote add origin https://github.com/[GITHUB-USERNAME]/[NAMA-PROJECT].git
git push -u origin main
```

Saat `git push`, GitHub akan meminta:
- **Username:** username GitHub Anda
- **Password:** **GUNAKAN PERSONAL ACCESS TOKEN (PAT)**, bukan password login
  - Cara buat PAT: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → centang `repo` scope → Generate → Copy token (format: `ghp_xxxxx...`)

#### OPSI B: SSH (lebih aman, tidak perlu input password tiap push)

**Setup SSH key (sekali saja):**
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "email-anda@contoh.com"
# Tekan Enter untuk semua prompt (default location, no passphrase)

# Tampilkan public key
cat ~/.ssh/id_ed25519.pub
# Copy output (format: ssh-ed25519 AAAA... email-anda@contoh.com)
```

**Tambahkan ke GitHub:**
1. Buka [github.com/settings/keys](https://github.com/settings/keys)
2. Klik **New SSH key**
3. **Title:** `Laptop saya` atau `Termux`
4. **Key type:** Authentication Key
5. **Key:** paste public key tadi
6. Klik **Add SSH key**

**Test koneksi SSH:**
```bash
ssh -T git@github.com
# Output: "Hi [USERNAME]! You've successfully authenticated..."
```

**Push pakai SSH:**
```bash
git init
git add .
git commit -m "Initial commit - First deploy"
git branch -M main
git remote add origin git@github.com:[GITHUB-USERNAME]/[NAMA-PROJECT].git
git push -u origin main
```

#### OPSI C: GitHub CLI (paling cepat untuk yang sudah terbiasa)

```bash
# Install GitHub CLI
# Mac:    brew install gh
# Linux:  https://github.com/cli/cli#installation
# Termux: pkg install gh

gh auth login
# Pilih: GitHub.com → HTTPS → Login via browser

# Buat repo & push sekali jadi:
gh repo create [NAMA-PROJECT] --private --source=. --remote=origin --push
```

### 4.3 Pastikan `.gitignore` Aman

Cek isi `.gitignore` di root project. **WAJIB** ada baris berikut:

```gitignore
# Environment files (JANGAN sampai ke GitHub!)
.env
.env.local
.env.production
.env*.local

# Node modules (terlalu besar)
node_modules/

# Build output
.next/
out/
dist/
build/

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*

# Local database (jika ada)
*.db
*.sqlite
```

**Test apakah `.env` akan ikut ter-push:**
```bash
git status
# Pastikan .env TIDAK muncul di list "Changes to be committed"
```

Kalau `.env` muncul, jangan push dulu! Perbaiki `.gitignore` lalu:
```bash
git rm --cached .env   # hapus dari staging kalau sudah ke-add
```

### 4.4 Verifikasi Push Berhasil

1. Buka `https://github.com/[GITHUB-USERNAME]/[NAMA-PROJECT]`
2. Pastikan semua file ada (kecuali `node_modules/` dan `.env`)
3. Cek: `.env` **TIDAK BOLEH** ada di repo (cek di folder root)
   - Kalau ada: HAPUS segera via GitHub web (Settings → Repository → Danger Zone → bisa tidak, harus hapus manual file + force push)

---

## LANGKAH 5: Deploy ke Vercel

### 5.1 Import Project

1. Login ke [vercel.com](https://vercel.com) (pakai GitHub)
2. Klik **Add New...** → **Project**
3. Di bagian "Import Git Repository", cari repo `[NAMA-PROJECT]`
4. Klik **Import**

### 5.2 Konfigurasi Deploy

Vercel akan auto-detect Next.js. **JANGAN klik Deploy dulu!** Atur dulu:

#### Build & Output Settings
- **Framework Preset:** Next.js (auto)
- **Build Command:** `npx prisma generate && next build` (tambahkan prisma generate di depan)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm install` (default)

#### Environment Variables (WAJIB sebelum Deploy)

Scroll ke bawah, klik **Environment Variables**. Tambahkan semua variable dari `.env`:

| Key | Value | Environments |
|-----|-------|--------------|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | (random string 32 chars) | Production, Preview, Development |
| `NEXT_PUBLIC_APP_NAME` | `[NAMA-PROJECT]` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://[NAMA-PROJECT].vercel.app` | Production |

> 💡 Setelah deploy pertama, Env Vars bisa di-edit di **Settings → Environment Variables**

### 5.3 Deploy

1. Klik **Deploy**
2. Tunggu 2-3 menit (build akan jalan)
3. Lihat log build — cari pesan "Build Completed"
4. Kalau sukses, akan muncul pesan: **"Congratulations! Your project is now live!"**
5. Klik **Visit** untuk buka URL: `https://[NAMA-PROJECT].vercel.app`

### 5.4 Cek Status Deploy

- Production deploy: otomatis setiap push ke `main` branch
- Preview deploy: otomatis setiap push ke branch lain (PR)
- Cek history: Vercel Dashboard → Project → Deployments

---

## LANGKAH 6: Setup Database di Produksi

Setelah Vercel deploy pertama, database Supabase **kosong** (tabel belum dibuat).

### 6.1 Push Schema ke Production Database

Jalankan **di local** dengan `.env` pointing ke Supabase production:

```bash
# Pastikan DATABASE_URL di .env = Supabase production URL
npx prisma db push
```

Verifikasi tabel terbuat:
1. Buka Supabase Dashboard → Table Editor
2. Harus ada tabel: `User`, `Mahasiswa`, `SesiUjian`, `SoalUjian`, `HasilUjian`, dll

### 6.2 Import Data Awal (jika ada script seed)

```bash
# Kalau ada script import data:
npx tsx scripts/import_data.ts

# Atau seed sample data:
npx tsx scripts/seed.ts
```

### 6.3 Buat Admin User di Production

Lihat [LANGKAH 3.3](#33-setup-admin-user) — jalankan sekali lagi dengan DATABASE_URL production.

> ⚠️ **Penting:** Ganti password admin dari `admin123` ke password kuat (min 12 karakter, kombinasi huruf/angka/simbol).

### 6.4 Verifikasi Koneksi Vercel → Supabase

1. Buka URL Vercel: `https://[NAMA-PROJECT].vercel.app`
2. Coba login admin
3. Kalau gagal, cek:
   - Vercel Dashboard → Settings → Environment Variables → pastikan `DATABASE_URL` benar
   - Supabase Dashboard → Settings → Database → pastikan "Connection pooling" aktif

---

## LANGKAH 7: Test & Verifikasi

### 7.1 Test Alur Utama

Buka `https://[NAMA-PROJECT].vercel.app` dan test:

- [ ] **Login Admin** → berhasil masuk dashboard
- [ ] **Buat materi baru** → muncul di list
- [ ] **Buat sesi ujian** → setting waktu & materi
- [ ] **Buat soal** (3 tipe: isian, mcq, sambung)
- [ ] **Preview soal** → tampil normal
- [ ] **Login Mahasiswa** (test account) → bisa lihat materi
- [ ] **Kerjakan ujian** → jawaban tersimpan
- [ ] **Submit ujian** → hasil muncul
- [ ] **Lihat hasil** di admin & mahasiswa panel

### 7.2 Cek Performance

```bash
# Test dengan curl (atau Postman):
curl -w "@curl-format.txt" -o /dev/null -s "https://[NAMA-PROJECT].vercel.app/"
```

Buat file `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer: %{time_pretransfer}\n
time_redirect:    %{time_redirect}\n
time_starttransfer: %{time_starttransfer}\n
time_total:       %{time_total}\n
```

Target: `time_total` < 2 detik untuk Indonesia.

---

## Custom Domain (Opsional)

### Mengapa Pakai Domain Sendiri?

- URL lebih profesional: `ujian.sekolah.ac.id` vs `mahad-lughah.vercel.app`
- Bisa custom email (`admin@ujian.sekolah.ac.id`)
- Branding konsisten

### Langkah Setup Domain Custom

#### A. Beli/Prepare Domain

- Beli domain di: Niagahoster, Rumahweb, Namecheap, Cloudflare, dll
- Atau gunakan subdomain dari institusi: `ujian.sekolah.ac.id`

#### B. Tambah Domain ke Vercel

1. Vercel Dashboard → Project → **Settings** → **Domains**
2. Klik **Add Domain**
3. Masukkan: `[DOMAIN-ANDA]` (mis. `ujian.sekolah.ac.id`)
4. Vercel akan tampilkan DNS records yang harus ditambahkan

#### C. Setting DNS di Domain Provider

Login ke panel domain Anda, tambah record:

**Untuk subdomain (mis. `ujian.sekolah.ac.id`):**
```
Type:  CNAME
Name:  ujian
Value: cname.vercel-dns.com
TTL:   3600 (1 jam)
```

**Untuk root domain (mis. `sekolah.ac.id`):**
```
Type:  A
Name: @
Value: 76.76.21.21  (Vercel IP)
TTL:   3600

Type:  A
Name: @
Value: 76.76.21.21
TTL:   3600

# Dan CNAME untuk www:
Type:  CNAME
Name: www
Value: cname.vercel-dns.com
TTL:   3600
```

#### D. Tunggu Propagasi DNS

- Cek dengan: `dig [DOMAIN-ANDA]` atau [whatsmydns.net](https://www.whatsmydns.net)
- Biasanya 5-30 menit (max 24 jam)

#### E. Vercel Auto-Provision SSL

- Setelah DNS resolve, Vercel otomatis request SSL certificate (Let's Encrypt, gratis)
- Tunggu 5-10 menit, lalu test: `https://[DOMAIN-ANDA]`

#### F. Update Environment Variable

Update di Vercel:
```
NEXT_PUBLIC_APP_URL = https://[DOMAIN-ANDA]
```

Redeploy (push commit kecil ke GitHub, atau klik "Redeploy" di Vercel).

---

## Deploy via Termux (HP Android)

Untuk yang tidak punya laptop, deploy bisa langsung dari HP pakai Termux.

### Install Termux

1. Download Termux dari F-Droid (jangan dari Play Store — versi outdated)
   - URL: [f-droid.org/packages/com.termux](https://f-droid.org/packages/com.termux)
2. Buka Termux, jalankan:
```bash
pkg update && pkg upgrade -y
termux-setup-storage   # akses folder Download HP
```

### Install Dependencies

```bash
pkg install nodejs git rsync openssh nano -y
```

### Setup SSH ke GitHub (sekali saja)

```bash
ssh-keygen -t ed25519 -C "termux-HP"
# Enter untuk semua prompt
cat ~/.ssh/id_ed25519.pub
# Copy output ke GitHub → Settings → SSH keys → New SSH key
```

Test koneksi:
```bash
ssh -T git@github.com
```

### Clone Project

```bash
cd ~
git clone git@github.com:[GITHUB-USERNAME]/[NAMA-PROJECT].git
cd [NAMA-PROJECT]
npm install
```

### Workflow Deploy dari HP

```bash
# Setiap ada update, copy file update ke folder project:
rsync -av --exclude='.git' --exclude='node_modules' \
  ~/storage/shared/Download/[FOLDER-UPDATE]/ ~/[NAMA-PROJECT]/

# Kalau ada perubahan package.json:
npm install

# Generate prisma (kalau schema berubah):
npx prisma generate

# Kalau ada perubahan database schema:
npx prisma db push

# Commit & push:
git add .
git commit -m "update: [deskripsi perubahan]"
git push origin main

# Vercel akan auto-deploy dalam 2-3 menit
```

### Tips Termux

- **Storage:** Pastikan sisa storage HP ≥ 1GB (project + node_modules ~500MB)
- **RAM:** Tutup app lain saat `npm install` (butuh banyak RAM)
- **Battery:** Charging saat install paket besar
- **Auto-CD:** Tambah ke `~/.bashrc`:
  ```bash
  echo 'cd ~/[NAMA-PROJECT] 2>/dev/null' >> ~/.bashrc
  ```

---

## Backup & Restore Database

### Backup Otomatis (Supabase Free)

Supabase Free tier punya:
- ✅ Auto-backup harian (retained 7 hari)
- ⚠️ Tidak bisa restore ke titik waktu tertentu (fitur Pro plan)

### Backup Manual (Export ke File)

Jalankan di local dengan `.env` pointing ke production Supabase:

```bash
# Export seluruh data ke JSON
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const db = new PrismaClient();

async function backup() {
  const tables = ['User', 'Mahasiswa', 'SesiUjian', 'SoalUjian', 'HasilUjian'];
  const data = {};
  for (const t of tables) {
    data[t] = await db[t.toLowerCase()].findMany();
    console.log('Backup', t, ':', data[t].length, 'records');
  }
  fs.writeFileSync('backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(data, null, 2));
  await db.\$disconnect();
}
backup();
"
```

Atau export via Supabase Dashboard:
1. Supabase Dashboard → Database → **Table Editor**
2. Pilih tabel → klik **Export** → CSV

### Backup via pg_dump (lebih lengkap)

```bash
# Install pg_dump kalau belum ada (di Linux/Mac):
# sudo apt install postgresql-client (Ubuntu)
# brew install postgresql (Mac)

# Dump database:
pg_dump "[DATABASE_URL]" -F c -f backup-$(date +%Y%m%d).dump

# Restore:
pg_restore -d "[DATABASE_URL]" backup-20250101.dump
```

### Schedule Backup Cron (Linux/Mac)

```bash
# Edit crontab:
crontab -e

# Tambah baris (backup tiap jam 2 pagi):
0 2 * * * cd /path/to/project && pg_dump "$DATABASE_URL" -F c -f /backups/db-$(date +\%Y\%m\%d).dump
```

---

## Limit Free Tier

### Vercel Free (Hobby)

| Resource | Limit | Cukup untuk |
|----------|-------|-------------|
| Bandwidth | 100 GB/bulan | ~200 mahasiswa aktif |
| Build minutes | 6.000 menit/bulan | ~100 deploy/bulan |
| Serverless function timeout | 10 detik | Operasi ringan (CRUD, query kecil) |
| Max deployments | 100/bulan | Lebih dari cukup |
| Edge requests | 1 juta/bulan | 200 mhs × 5.000 request |

### Supabase Free

| Resource | Limit | Cukup untuk |
|----------|-------|-------------|
| Database size | 500 MB | 200 mhs + ribuan soal + hasil ujian |
| Auth users | 50.000 MAU | Lebih dari cukup |
| API requests | 50.000/bulan | Ujian harian 200 mhs |
| Bandwidth | 5 GB/bulan | Cukup |
| Storage | 1 GB | Kalau ada file upload (foto, dokumen) |

### Kapan Harus Upgrade?

**Vercel Pro ($20/bln):**
- Function timeout 10s kurang (operasi berat > 10 detik)
- Bandwidth > 100 GB
- Butuh team collaboration (multi-user)

**Supabase Pro ($25/bln):**
- Database > 500 MB
- Butuh point-in-time recovery
- Daily backups > 7 hari
- API requests > 50.000/bulan

**Estimasi:** Untuk 200 mahasiswa dengan ujian window 1-2 jam, **FREE TIER SANGAT CUKUP**.

---

## Troubleshooting

### ❌ "Prisma can't connect to database"

**Kemungkinan & Solusi:**

1. **Password salah di `DATABASE_URL`**
   - Cek karakter spesial: kalau ada `@`, `#`, `?` di password, harus di-URL-encode
   - Contoh: password `P@ssw0rd` → `P%40ssw0rd`

2. **Project ref salah**
   - Cek di Supabase Dashboard → Settings → General → "Reference ID"

3. **Database paused (Supabase Free)**
   - Supabase Free akan pause otomatis setelah 7 hari tidak aktif
   - Login ke Supabase Dashboard → klik "Restore" → tunggu 1-2 menit

4. **Connection pool penuh**
   - Supabase Free: max 60 concurrent connections
   - Solusi: pakai connection string dengan `?pgbouncer=true&connection_limit=1` di akhir URL

### ❌ "Build failed" di Vercel

**Cek log:**

1. Buka Vercel Dashboard → Project → Deployments
2. Klik deploy yang failed → **Building** log
3. Cari baris error

**Solusi umum:**

- **"Cannot find module '@prisma/client'"**
  - Edit Build Command: `npx prisma generate && next build`

- **"TypeScript error: Type X is not assignable..."**
  - Tambah `// @ts-ignore` di atas baris error, ATAU
  - Edit `tsconfig.json`: set `"strict": false` (sementara)

- **"Module not found: Can't resolve 'X'"**
  - Cek file `.env` ada semua variable yang dibutuhkan
  - Cek `package.json` — mungkin ada dependency yang belum di-install

### ❌ "Function timeout exceeded"

- Vercel Free: max 10 detik per API call
- Operasi berat (import 225 mahasiswa sekaligus) mungkin timeout
- Solusi:
  1. Pecah jadi batch kecil (50 record per request)
  2. Atau jalankan operasi berat di local, bukan via Vercel
  3. Atau upgrade ke Vercel Pro (60s timeout)

### ❌ Data tiba-tiba hilang?

- Supabase = **persistent** (data tidak hilang kecuali di-delete)
- Cek: apakah `npx prisma db push --accept-data-loss` pernah dijalankan? (bisa reset data)
- Cek Supabase Dashboard → Database → Tables → apakah tabel & data masih ada?
- Cek Environment Variable di Vercel: pastikan `DATABASE_URL` mengarah ke project Supabase yang benar (bukan project lain/testing)

### ❌ "Domain tidak bisa diakses"

1. Cek DNS: `dig [DOMAIN-ANDA]` atau [whatsmydns.net](https://www.whatsmydns.net)
2. Cek Vercel Dashboard → Settings → Domains → status harus "Valid Configuration"
3. Kalau status "Invalid Configuration":
   - Cek DNS records di provider domain (CNAME ke `cname.vercel-dns.com`)
   - Tunggu 30 menit - 24 jam untuk propagasi DNS

### ❌ "CORS error" di browser console

- Vercel Domain: pastikan `NEXT_PUBLIC_APP_URL` di Vercel Env Vars = URL final
- Kalau pakai custom domain: set `NEXT_PUBLIC_APP_URL = https://[DOMAIN-ANDA]`
- Redeploy setelah ubah Env Var

---

## Best Practices Keamanan

### 1. Jangan Commit `.env` ke GitHub

```bash
# Cek file apa yang akan di-commit:
git status

# Pastikan .env TIDAK muncul di "Changes to be committed"
# Kalau sudah ke-add, hapus dari staging:
git rm --cached .env
git commit -m "remove .env from tracking"
```

Kalau `.env` SUDAH ter-push ke GitHub (PRIVATE repo):
1. **Segera** ganti semua password/secrets di file `.env`:
   - Password Supabase → reset di Supabase Dashboard
   - Generate `NEXTAUTH_SECRET` baru: `openssl rand -base64 32`
2. Update Vercel Environment Variables dengan value baru
3. Hapus file `.env` dari history git:
   ```bash
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch .env' \
     --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```
4. Atau pakai BFG Repo-Cleaner (lebih mudah):
   ```bash
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

### 2. Ganti Password Default

Setelah deploy pertama:
- [ ] Login admin → Settings → Ganti password dari `admin123` ke password kuat
- [ ] Password Supabase → gunakan password yang berbeda dari password admin app

### 3. Aktifkan 2FA

- GitHub: Settings → Password and authentication → Two-factor authentication
- Vercel: Settings → Two-Factor Authentication
- Supabase: Account → Security → Enable 2FA

### 4. Audit Access

- Vercel Dashboard → Settings → Members → hapus member yang tidak perlu
- Supabase Dashboard → Organization → Members → hapus yang tidak perlu
- GitHub: Settings → Collaborators and teams → hapus yang tidak perlu

### 5. Monitor Logs

- **Vercel:** Dashboard → Project → Logs (real-time)
- **Supabase:** Dashboard → Logs → Postgres logs / API logs
- Setup alerting email kalau ada error

### 6. Backup Berkala

- Setiap bulan: export database ke local (lihat section Backup)
- Simpan di cloud storage (Google Drive, Dropbox)
- Test restore minimal sekali (pastikan backup work)

---

## Kontak & Support

Jika mengalami masalah setelah deploy:

1. **Cek dokumentasi resmi:**
   - Vercel: [vercel.com/docs](https://vercel.com/docs)
   - Supabase: [supabase.com/docs](https://supabase.com/docs)
   - Prisma: [prisma.io/docs](https://www.prisma.io/docs)
   - Next.js: [nextjs.org/docs](https://nextjs.org/docs)

2. **Cek log aplikasi:**
   - Vercel Dashboard → Project → Functions → Logs
   - Supabase Dashboard → Logs → Postgres logs

3. **Komunitas:**
   - Stack Overflow: tag `[vercel]`, `[supabase]`, `[next.js]`, `[prisma]`
   - Discord Vercel: [vercel.com/discord](https://vercel.com/discord)
   - Discord Supabase: [supabase.com/discord](https://supabase.com/discord)

4. **Kontak developer asli (jika ada):**
   - Email: `[EMAIL-DEVELOPER]`
   - WhatsApp: `[WA-DEVELOPER]`

---

## Checklist Akhir

Sebelum aplikasi dianggap "live & production-ready":

- [ ] Supabase project aktif, connection string dicatat
- [ ] `prisma/schema.prisma` provider = `postgresql`
- [ ] `.env` ada & berisi `DATABASE_URL` valid
- [ ] `.gitignore` mengandung `.env`
- [ ] GitHub repo dibuat (Private direkomendasikan)
- [ ] SSH key atau PAT ter-setup
- [ ] `git push` berhasil, `.env` tidak ikut ter-commit
- [ ] Vercel project di-import dari GitHub
- [ ] Environment Variables di Vercel sudah diisi semua
- [ ] Build Command: `npx prisma generate && next build`
- [ ] Deploy pertama sukses
- [ ] `npx prisma db push` di-run di production database
- [ ] Admin user dibuat & password diganti dari default
- [ ] Test login admin & mahasiswa berhasil
- [ ] Test CRUD: buat materi, sesi, soal, kerjakan ujian
- [ ] (Opsional) Custom domain ter-setup & SSL aktif
- [ ] Backup database pertama dijalankan & disimpan aman

---

**Dokumen versi:** 2.0
**Last updated:** Oktober 2026
