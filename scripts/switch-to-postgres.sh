#!/bin/bash
# Script untuk switch Prisma provider: SQLite → PostgreSQL (untuk produksi)
# Jalankan SEBELUM push ke GitHub / deploy ke Vercel

set -e

SCHEMA="prisma/schema.prisma"

echo "🔄 Mengubah Prisma provider: sqlite → postgresql..."
sed -i 's/provider = "sqlite"/provider = "postgresql"/g' "$SCHEMA"

echo "✅ Prisma schema sekarang menggunakan PostgreSQL"
echo ""
echo "Provider saat ini:"
grep "provider" "$SCHEMA" | head -1
echo ""
echo "Langkah selanjutnya:"
echo "1. Set DATABASE_URL di .env ke Supabase connection string"
echo "2. Jalankan: npx prisma db push (buat tabel di Supabase)"
echo "3. Jalankan: npx tsx scripts/import_real_data.ts (import mahasiswa)"
echo "4. git add . && git commit -m 'Switch to PostgreSQL' && git push"
echo "5. Connect repo ke Vercel untuk auto-deploy"
echo ""
echo "Untuk kembali ke SQLite (dev): jalankan ./scripts/switch-to-sqlite.sh"
