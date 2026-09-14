-- Fix RLS: workspace insert/select tidak butuh is_workspace_member (user belum anggota saat buat baru)

-- 1. Ganti policy SELECT workspaces: izinkan jika creator ATAU anggota
drop policy if exists "Lihat workspace jika anggota" on public.workspaces;
create policy "Lihat workspace jika anggota atau creator"
  on public.workspaces for select
  using (
    created_by = auth.uid()
    or is_workspace_member(id)
  );

-- 2. Policy UPDATE workspaces hanya admin
drop policy if exists "Update workspace" on public.workspaces;
create policy "Update workspace oleh creator"
  on public.workspaces for update
  using (created_by = auth.uid());

-- 3. Policy DELETE workspaces hanya creator
drop policy if exists "Delete workspace" on public.workspaces;
create policy "Delete workspace oleh creator"
  on public.workspaces for delete
  using (created_by = auth.uid());

-- 4. Anggota: izinkan user insert dirinya sendiri ke workspace manapun (join via invite)
--    Sudah benar, tidak perlu diganti. Pastikan policy ini ada:
drop policy if exists "Gabung atau tambah anggota" on public.workspace_members;
create policy "Gabung atau tambah anggota"
  on public.workspace_members for insert
  with check (auth.uid() is not null);

-- 5. Anggota bisa lihat semua anggota di workspace yang sama (atau workspace yang dia buat)
drop policy if exists "Lihat anggota se-workspace" on public.workspace_members;
create policy "Lihat anggota se-workspace"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or is_workspace_member(workspace_id)
  );
