-- ============================================================
-- DompetBareng: Fix RLS Transaksi & Tambah Kolom updated_at
-- Jalankan script ini di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom updated_at pada tabel transactions jika belum ada
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- 2. Pastikan RLS aktif
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. Drop policy lama pada transactions untuk menghindari konflik
DROP POLICY IF EXISTS "tx_all" ON public.transactions;
DROP POLICY IF EXISTS "tx_select" ON public.transactions;
DROP POLICY IF EXISTS "tx_insert" ON public.transactions;
DROP POLICY IF EXISTS "tx_update" ON public.transactions;
DROP POLICY IF EXISTS "tx_delete" ON public.transactions;

-- 4. Policy SELECT: Anggota workspace atau pembuat transaksi
CREATE POLICY "tx_select" ON public.transactions FOR SELECT
  USING (
    is_workspace_member(workspace_id)
    OR workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
    OR user_id = auth.uid()
  );

-- 5. Policy INSERT: Anggota workspace
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id)
    OR workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
    OR user_id = auth.uid()
  );

-- 6. Policy UPDATE: Anggota workspace atau pembuat transaksi
CREATE POLICY "tx_update" ON public.transactions FOR UPDATE
  USING (
    is_workspace_member(workspace_id)
    OR workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
    OR user_id = auth.uid()
  )
  WITH CHECK (
    is_workspace_member(workspace_id)
    OR workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
    OR user_id = auth.uid()
  );

-- 7. Policy DELETE: Anggota workspace atau pembuat transaksi
CREATE POLICY "tx_delete" ON public.transactions FOR DELETE
  USING (
    is_workspace_member(workspace_id)
    OR workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
    OR user_id = auth.uid()
  );
