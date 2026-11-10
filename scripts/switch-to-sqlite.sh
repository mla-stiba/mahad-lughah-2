#!/bin/bash
# Script untuk switch Prisma provider: PostgreSQL → SQLite (untuk dev/sandbox)
# Jalankan kalau mau kembali ke SQLite untuk development

set -e

SCHEMA="prisma/schema.prisma"

echo "🔄 Mengubah Prisma provider: postgresql → sqlite..."
sed -i 's/provider = "postgresql"/provider = "sqlite"/g' "$SCHEMA"

echo "✅ Prisma schema sekarang menggunakan SQLite"
echo ""
echo "Provider saat ini:"
grep "provider" "$SCHEMA" | head -1
echo ""
echo "Untuk produksi: jalankan ./scripts/switch-to-postgres.sh"
