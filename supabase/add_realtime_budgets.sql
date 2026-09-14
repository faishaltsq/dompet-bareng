-- ═══════════════════════════════════════════════════════════════════════════
-- DompetBareng: Fitur Baru — Realtime + Budgeting
-- Jalankan seluruh SQL ini di Supabase SQL Editor satu kali
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1. ENABLE REALTIME PUBLICATION ═══
-- Agar perubahan transaksi & member langsung tersinkronisasi antar device
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;

-- ═══ 2. TABEL WORKSPACE BUDGETS (Kuota Anggaran Kategori Bulanan) ═══
CREATE TABLE IF NOT EXISTS public.workspace_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  month integer NOT NULL CHECK (month BETWEEN 0 AND 11),
  year integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, category, month, year)
);

ALTER TABLE public.workspace_budgets ENABLE ROW LEVEL SECURITY;

-- SELECT: semua anggota workspace bisa lihat budget
CREATE POLICY "wb_select" ON public.workspace_budgets FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT/UPDATE/DELETE: hanya admin workspace
CREATE POLICY "wb_admin_insert" ON public.workspace_budgets FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

CREATE POLICY "wb_admin_update" ON public.workspace_budgets FOR UPDATE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

CREATE POLICY "wb_admin_delete" ON public.workspace_budgets FOR DELETE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin'
    )
  );

-- Realtime juga untuk budgets
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_budgets;

-- ═══ 3. FIX RLS: workspace_members DELETE ═══
-- Member bisa keluar sendiri, admin bisa kick anggota lain
DROP POLICY IF EXISTS "wm_delete" ON public.workspace_members;
CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_id AND created_by = auth.uid()
    )
  );
