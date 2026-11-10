-- ============================================================
-- SUPABASE OPTIMIZATION SCRIPT
-- ============================================================
-- CARA PAKAI:
-- 1. Login ke Supabase Dashboard -> https://supabase.com/dashboard
-- 2. Pilih project Anda -> SQL Editor (sidebar kiri)
-- 3. Paste semua isi file ini -> Run
-- 4. Cek di Advisors/Health panel -> masalah "Unindexed FK" & "RLS Disabled" harus hilang
--
-- EFEK:
-- - Aktifkan RLS (Row Level Security) untuk SEMUA tabel public
-- - Tambah index untuk foreign keys (mempercepat INSERT, UPDATE, DELETE, JOIN)
-- - Tidak menghapus / mengubah data existing
-- - Aman dijalankan berkali-kali (pakai IF NOT EXISTS pattern)
-- ============================================================

-- ============================================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS) untuk semua tabel
-- ============================================================
-- RLS wajib diaktifkan walau belum ada policy. Tanpa RLS,
-- siapa saja dengan anon key bisa SELECT/INSERT/UPDATE/DELETE
-- data mahasiswa, user, dll langsung lewat REST API Supabase.

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Kamar"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Level"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mahasiswa"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Materi"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SesiUjian"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SoalUjian"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HasilUjian"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DetailHasil"  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. INDEX UNTUK FOREIGN KEYS
-- ============================================================
-- PostgreSQL TIDAK otomatis bikin index untuk FK column.
-- Tanpa index, setiap INSERT ke child table akan trigger
-- full table scan di parent table untuk validasi constraint.
-- Ini penyebab utama batch INSERT CSV lambat.

-- Helper: buat index jika belum ada (PostgreSQL 9.5+ tidak punya CREATE INDEX IF NOT EXISTS secara native sebelum 9.5, tapi Supabase sudah 14+)
CREATE INDEX IF NOT EXISTS idx_mahasiswa_kamar_id           ON "Mahasiswa"  ("kamarId");
CREATE INDEX IF NOT EXISTS idx_materi_level_id              ON "Materi"     ("levelId");
CREATE INDEX IF NOT EXISTS idx_materi_jenis                 ON "Materi"     ("jenis");
CREATE INDEX IF NOT EXISTS idx_materi_kategori              ON "Materi"     ("kategori");
CREATE INDEX IF NOT EXISTS idx_sesi_ujian_level_id          ON "SesiUjian"  ("levelId");
CREATE INDEX IF NOT EXISTS idx_sesi_ujian_aktif             ON "SesiUjian"  ("aktif");
CREATE INDEX IF NOT EXISTS idx_soal_ujian_sesi_id           ON "SoalUjian"  ("sesiId");
CREATE INDEX IF NOT EXISTS idx_soal_ujian_materi_id        ON "SoalUjian"  ("materiId");
CREATE INDEX IF NOT EXISTS idx_soal_ujian_jenis            ON "SoalUjian"  ("jenis");
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_sesi_id         ON "HasilUjian" ("sesiId");
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_mahasiswa_id    ON "HasilUjian" ("mahasiswaId");
CREATE INDEX IF NOT EXISTS idx_hasil_ujian_status          ON "HasilUjian" ("status");
CREATE INDEX IF NOT EXISTS idx_detail_hasil_soal_id        ON "DetailHasil"("soalId");
CREATE INDEX IF NOT EXISTS idx_detail_hasil_status         ON "DetailHasil"("status");

-- ============================================================
-- 3. DROP UNUSED INDEX (jika ada di DetailHasil - cek dulu via Advisor)
-- ============================================================
-- Catatan: hanya jalankan DROP kalau Advisor Supabase eksplisit
-- menyebut index X di tabel Y sebagai "Unused".
-- Advisor biasanya menyebut nama index spesifik. Jangan drop sembarangan.
-- Contoh (UNCOMMENT kalau Advisor menyarankan):
-- DROP INDEX IF EXISTS "DetailHasil_.index_name_here";

-- ============================================================
-- 4. OPSIONAL: Tambah policy untuk akses via Supabase client
-- ============================================================
-- Kalau Anda tidak pernah pakai Supabase JS client (anon key) di
-- frontend (hanya pakai Prisma via API route Next.js), Anda TIDAK
-- perlu menambah policy. RLS aktif = default deny, dan Prisma
-- pakai service_role key yang bypass RLS.
--
-- Tapi kalau Anda berencana pakai Supabase client untuk read data
-- publik (misal: read-only daftar kamar tanpa login), tambahkan:
--
-- CREATE POLICY "read_public_kamar"  ON "Kamar"  FOR SELECT USING (true);
-- CREATE POLICY "read_public_level"  ON "Level"  FOR SELECT USING (true);
-- CREATE POLICY "read_public_materi_publik" ON "Materi"
--   FOR SELECT USING ("tanggalRilis" IS NOT NULL AND "tanggalRilis" <= NOW());

-- ============================================================
-- 5. VACUUM & ANALYZE (refresh statistik DB)
-- ============================================================
-- Setelah create index, jalankan ANALYZE supaya query planner
-- pakai index baru. Tanpa ANALYZE, Postgres masih pake estimasi lama.
ANALYZE "Mahasiswa";
ANALYZE "Materi";
ANALYZE "SesiUjian";
ANALYZE "SoalUjian";
ANALYZE "HasilUjian";
ANALYZE "DetailHasil";

-- ============================================================
-- SELESAI. Cek Supabase Dashboard -> Advisors -> Health.
-- Issue "RLS Disabled" dan "Unindexed Foreign Keys" harus bersih.
-- ============================================================
