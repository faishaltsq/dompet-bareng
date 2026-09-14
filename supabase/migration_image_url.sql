-- Migration: tambah kolom image_url di workspaces, transactions, dan buat bucket storage
-- Jalankan di Supabase SQL Editor

-- 1. Tambah kolom image_url di tabel workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Tambah kolom image_url di tabel transactions (untuk foto struk/nota)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Buat bucket workspace-images (PUBLIC — untuk embed di app tanpa auth header)
-- Jalankan di Dashboard → Storage → New Bucket
-- Nama: workspace-images, Public: ON
-- Atau via SQL (hanya tersedia di self-hosted / via API):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('workspace-images', 'workspace-images', true);

-- 3. Storage Policy: anyone can read (public bucket)
-- Sudah otomatis jika bucket diset Public dari Dashboard.

-- 4. Storage Policy: authenticated user bisa upload ke folder manapun
-- (Jalankan di Storage → Policies jika diperlukan)
-- CREATE POLICY "auth upload" ON storage.objects FOR INSERT TO authenticated USING (bucket_id = 'workspace-images');
-- CREATE POLICY "public read" ON storage.objects FOR SELECT USING (bucket_id = 'workspace-images');
