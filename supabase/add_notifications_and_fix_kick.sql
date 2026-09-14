-- ============================================================
-- DompetBareng: Fix Kick Member & Fitur Notifikasi In-App
-- Jalankan script ini di Supabase SQL Editor
-- ============================================================

-- 1. Helper function SECURITY DEFINER: daftar workspace di mana user adalah admin
CREATE OR REPLACE FUNCTION public.user_admin_workspace_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = uid AND role = 'admin';
$$;

-- 2. Perbarui policy DELETE pada workspace_members
--    User bisa keluar sendiri (user_id = auth.uid())
--    ATAU admin workspace bisa mengeluarkan member lain
DROP POLICY IF EXISTS "wm_delete" ON public.workspace_members;
CREATE POLICY "wm_delete"
  ON public.workspace_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    workspace_id IN (SELECT public.user_admin_workspace_ids(auth.uid()))
  );

-- 3. Tabel notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- 'member_kicked' | 'info' | 'system'
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks query
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);

-- RLS untuk notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
CREATE POLICY "notif_delete"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Aktifkan Realtime untuk tabel notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
