-- DompetBareng: Skema Database (master)
-- Jalankan di Supabase SQL Editor

-- 1. EXTENSION
create extension if not exists "pgcrypto";

-- 2. TABEL WORKSPACES
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- 3. TABEL ANGGOTA
create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')) default 'member',
  joined_at timestamptz default now() not null,
  primary key (workspace_id, user_id)
);

-- 4. TABEL TRANSAKSI
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(15,2) not null check (amount > 0),
  category text not null,
  description text,
  transaction_date date default current_date not null,
  created_at timestamptz default now() not null
);

-- 5. TABEL INVITE LINK
create table public.workspace_invites (
  token text primary key default encode(gen_random_bytes(16), 'hex'),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now() not null
);

-- 6. SECURITY HELPER FUNCTION
-- PENTING: security definer agar bypass RLS saat dipanggil dari policy
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- 7. AKTIFKAN RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.transactions enable row level security;
alter table public.workspace_invites enable row level security;

-- 8. POLICIES: WORKSPACES
-- SELECT: creator ATAU member (via security definer function — aman, tidak rekursif)
create policy "ws_select"
  on public.workspaces for select
  using (
    created_by = auth.uid()
    or is_workspace_member(id)
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

-- 9. POLICIES: WORKSPACE_MEMBERS
-- KUNCI: JANGAN panggil is_workspace_member() di sini
--        karena is_workspace_member query workspace_members → infinite recursion
-- SELECT: user bisa lihat SEMUA anggota di workspace yang dia ikuti
create policy "wm_select"
  on public.workspace_members for select
  using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
  );

-- INSERT: siapapun yang login boleh join
create policy "wm_insert"
  on public.workspace_members for insert
  with check (auth.uid() is not null);

-- DELETE: diri sendiri bisa keluar workspace
create policy "wm_delete"
  on public.workspace_members for delete
  using (user_id = auth.uid());

-- 10. POLICIES: TRANSACTIONS
create policy "tx_all"
  on public.transactions for all
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

-- 11. POLICIES: INVITES
create policy "invite_select"
  on public.workspace_invites for select
  using (expires_at > now());

create policy "invite_insert"
  on public.workspace_invites for insert
  with check (is_workspace_member(workspace_id));
