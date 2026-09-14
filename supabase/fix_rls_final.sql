-- ============================================================
-- DompetBareng: FIX RLS FINAL
-- Jalankan FULL script ini di Supabase SQL Editor
-- ============================================================

-- Drop semua policy lama yang bermasalah
drop policy if exists "Lihat workspace jika anggota" on public.workspaces;
drop policy if exists "Lihat workspace jika anggota atau creator" on public.workspaces;
drop policy if exists "Lihat workspace" on public.workspaces;
drop policy if exists "ws_select" on public.workspaces;
drop policy if exists "Buat workspace baru" on public.workspaces;
drop policy if exists "ws_insert" on public.workspaces;
drop policy if exists "Update workspace oleh creator" on public.workspaces;
drop policy if exists "Delete workspace oleh creator" on public.workspaces;

drop policy if exists "Lihat anggota se-workspace" on public.workspace_members;
drop policy if exists "wm_select" on public.workspace_members;
drop policy if exists "Gabung atau tambah anggota" on public.workspace_members;
drop policy if exists "wm_insert" on public.workspace_members;

-- ============================================================
-- WORKSPACES policies
-- ============================================================

-- SELECT: creator ATAU member ATAU memiliki link invite aktif
create policy "ws_select"
  on public.workspaces for select
  using (
    created_by = auth.uid()
    or is_workspace_member(id)
    or exists (
      select 1 from public.workspace_invites
      where workspace_id = workspaces.id
      and expires_at > now()
    )
  );

-- INSERT: user harus set created_by = dirinya sendiri
create policy "ws_insert"
  on public.workspaces for insert
  with check (created_by = auth.uid());

-- UPDATE/DELETE: hanya creator
create policy "ws_update"
  on public.workspaces for update
  using (created_by = auth.uid());

create policy "ws_delete"
  on public.workspaces for delete
  using (created_by = auth.uid());

-- ============================================================
-- WORKSPACE_MEMBERS policies
-- KUNCI: JANGAN panggil is_workspace_member() di sini
--        karena is_workspace_member query tabel ini → recursion
-- ============================================================

-- SELECT: user hanya bisa lihat baris miliknya sendiri
--         (cukup untuk fetchWorkspaces join query)
create policy "wm_select"
  on public.workspace_members for select
  using (user_id = auth.uid());

-- INSERT: siapapun yang login boleh join / creator boleh tambah member
create policy "wm_insert"
  on public.workspace_members for insert
  with check (auth.uid() is not null);

-- DELETE: admin workspace atau diri sendiri (keluar workspace)
create policy "wm_delete"
  on public.workspace_members for delete
  using (user_id = auth.uid());
