-- Fix: Anggota workspace bisa melihat semua anggota di workspace yang sama
-- Sebelumnya: user_id = auth.uid() (hanya bisa lihat dirinya sendiri)
-- Sesudahnya: bisa lihat semua member di workspace yang dia ikuti

-- Drop policy lama
DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;

-- Policy baru: bisa lihat semua member di workspace yang kamu ikuti
-- Menggunakan subquery langsung (bukan is_workspace_member) untuk hindari infinite recursion
CREATE POLICY "wm_select"
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );
