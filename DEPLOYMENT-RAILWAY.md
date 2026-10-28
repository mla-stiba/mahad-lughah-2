# Panduan Deploy: Railway (PALING MUDAH)

## Yang Anda Butuhkan
- Akun GitHub (gratis) — untuk simpan kode
- Akun Railway (gratis, $5 credit/bulan) — untuk hosting + database

**Tidak perlu Supabase terpisah — Railway sudah include PostgreSQL!**

---

## LANGKAH 1: Download Kode

Kode aplikasi ada di folder project di server ini. Anda perlu download semua file ke komputer Anda.

Kalau saya sudah siapkan ZIP, download langsung. Kalau belum, copy manual file berikut ke folder di komputer Anda (mis. `D:\mahad-lughah`):
- Folder `src/` (semua file)
- Folder `prisma/` (schema.prisma)
- Folder `public/` (branding/, uploads/, dll)
- Folder `scripts/` (import_real_data.ts, seed.ts, dll)
- File: `package.json`, `next.config.ts`, `tsconfig.json`, `railway.json`, `.gitignore`, `.env.example`
- File: `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`

---

## LANGKAH 2: Install di Komputer Anda

1. Install **Node.js**: download dari [nodejs.org](https://nodejs.org) — pilih LTS version
2. Install **Git**: download dari [git-scm.com](https://git-scm.com)
3. Buka **Command Prompt** (Windows) atau **Terminal** (Mac/Linux):

```bash
cd D:\mahad-lughah
npm install
```

Tunggu sampai selesai (2-5 menit).

---

## LANGKAH 3: Buat Repo GitHub

1. Buka [github.com/new](https://github.com/new)
2. **Repository name**: `mahad-lughah`
3. Pilih **Private** (penting — ada data mahasiswa)
4. Klik **Create repository**
5. Di terminal (masih di folder project):

```bash
git init
git add .
git commit -m "Ma'had Lughah IAI STIBA Makassar"
git branch -M main
git remote add origin https://github.com/USERNAME-ANDA/mahad-lughah.git
git push -u origin main
```

Ganti `USERNAME-ANDA` dengan username GitHub Anda.

**Cek**: Pastikan file `.env` TIDAK ter-upload ke GitHub (sudah di .gitignore).

---

## LANGKAH 4: Deploy ke Railway

1. Buka [railway.app](https://railway.app) → klik **Login** → pakai GitHub
2. Klik **New Project**
3. Pilih **Deploy from GitHub repo** → cari `mahad-lughah` → klik
4. Railway mulai auto-build (tunggu 3-5 menit)
5. Klik tab **Settings** → **Variables** → tambah:
   - **Name**: `DATABASE_URL`
   - **Value**: (kosong dulu, akan diisi di Langkah 5)
6. Klik tab **Settings** → **Networking** → **Generate Domain**
   - Anda dapat URL: `https://mahad-lughah-production.up.railway.app`

---

## LANGKAH 5: Tambah Database PostgreSQL

1. Di Railway dashboard, klik **+ New → Database → Add PostgreSQL**
2. Railway buat database otomatis
3. Klik database PostgreSQL yang baru dibuat → tab **Connect**
4. Copy **Connection URL** (format: `postgresql://postgres:password@host:port/railway`)
5. Balik ke project (service) → tab **Variables** → set:
   ```
   DATABASE_URL = (paste connection URL dari PostgreSQL)
   ```

---

## LANGKAH 6: Buat Tabel & Import Data

Di komputer Anda, set `.env` dengan DATABASE_URL dari Railway:

```bash
# Edit file .env, isi dengan DATABASE_URL dari Railway PostgreSQL
# Lalu jalankan:
npx prisma db push
```

Tunggu sampai "Your database is now in sync" — semua tabel dibuat.

Lalu import data mahasiswa:

```bash
npx tsx scripts/import_real_data.ts
```

Buat admin:

```bash
node -e "const{PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.user.create({data:{username:'admin',password:'pKZ57d1Jg',role:'admin',name:'Admin'}}).then(()=>{console.log('Admin dibuat');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
```

---

## LANGKAH 7: Test!

1. Buka URL Railway Anda (mis. `https://mahad-lughah-production.up.railway.app`)
2. Login Admin: `admin` / `pKZ57d1Jg`
3. Login Mahasiswa: NIM `2657184001` / password `15042005`
4. **Data PERMANEN** — tidak hilang lagi!

---

## Setelah Deploy: Update Kode

Kalau mau update aplikasi (mis. fix bug, tambah fitur):

```bash
# Di komputer Anda:
git add .
git commit -m "Update: [deskripsi perubahan]"
git push
```

Railway auto-redeploy setiap ada push ke GitHub. **Tidak perlu deploy manual lagi!**

---

## Limits Railway Free Tier

| Limit | Free Tier | Cukup? |
|-------|-----------|--------|
| Credit | $5/bulan | ✅ (untuk 200 mhs, ujian 1-2 jam) |
| Database | 1GB PostgreSQL | ✅ |
| Bandwidth | 100GB/bulan | ✅ |
| Sleep | Setelah 15 menit idle, app sleep | ⚠️ (bangun saat ada request, ~5 detik delay) |

**Kalau perlu tanpa sleep**: upgrade ke Railway Pro ($20/bln) — app selalu aktif.

---

## Troubleshooting

### "Build failed"
- Cek Railway logs: klik service → tab **Deployments** → lihat log merah
- Pastikan `npm install` berhasil di komputer Anda dulu
- Kalau error Prisma: pastikan `postinstall: "prisma generate"` ada di package.json

### "Cannot connect to database"
- Cek `DATABASE_URL` di Railway Variables — pastikan connection URL PostgreSQL benar
- Pastikan tidak ada spasi di awal/akhir value

### "App sleep / loading lambat"
- Railway free tier: app sleep setelah 15 menit idle
- Saat mahasiswa buka URL, butuh ~5 detik untuk bangun
- Solusi: upgrade ke Pro ($20/bln) atau pakai uptime monitor (free, ping tiap 5 menit)
