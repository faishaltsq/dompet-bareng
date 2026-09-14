-- ============================================================
-- Fix: RLS infinite recursion pada workspace_members
-- Root cause: policy wm_select queries workspace_members dari
--             workspace_members → infinite recursion.
-- Fix: pakai SECURITY DEFINER function untuk bypass RLS check.
-- Jalankan di Supabase SQL Editor.
-- ============================================================

-- 1. Drop policy rekursif
DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;

-- 2. Function SECURITY DEFINER: return workspace IDs yang user ikuti
--    SECURITY DEFINER = bypass RLS → tidak recursive
CREATE OR REPLACE FUNCTION public.user_workspace_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = uid;
$$;

-- 3. Policy baru: bisa lihat SEMUA member di workspace yang user ikuti
--    Tanpa recursion karena function di atas bypass RLS
CREATE POLICY "wm_select"
  ON public.workspace_members FOR SELECT
  USING (
    workspace_id IN (SELECT public.user_workspace_ids(auth.uid()))
  );
