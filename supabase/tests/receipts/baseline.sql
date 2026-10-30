-- Isolated PostgreSQL 17 baseline for receipt storage policy proofs.
-- Models the live shapes this migration touches: transactions, membership,
-- auth helpers, storage.buckets/objects, storage.foldername, grants and RLS.
-- Synthetic UUIDs only; never applied to the live project.

create extension if not exists pgcrypto;

create schema auth;
create role anon nologin;
create role authenticated nologin;

create table auth.users (
  id uuid primary key,
  email text,
  is_anonymous boolean not null default false,
  raw_app_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;

-- Supabase Storage shape (subset used by the policies under test).
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  owner_id text,
  created_at timestamptz not null default now()
);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select, insert on storage.objects to anon;
grant select on storage.buckets to anon, authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users,
  display_name text,
  avatar_url text,
  email text
);
create table public.workspace_members (
  workspace_id uuid references public.workspaces on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces,
  user_id uuid not null references auth.users,
  type text not null check (type in ('income', 'expense')),
  amount numeric(15,2) not null check (amount > 0),
  category text not null,
  description text,
  image_url text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create function public.is_workspace_member(ws_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  )
$$;
create function public.user_workspace_ids(uid uuid) returns setof uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select workspace_id from public.workspace_members where user_id = uid and uid = auth.uid()
$$;
create function public.user_admin_workspace_ids(uid uuid) returns setof uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select workspace_id from public.workspace_members
  where user_id = uid and uid = auth.uid() and role = 'admin'
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.transactions enable row level security;

create policy ws_select on public.workspaces for select
  using (created_by = auth.uid() or public.is_workspace_member(id));
create policy ws_insert on public.workspaces for insert with check (created_by = auth.uid());
create policy ws_update on public.workspaces for update using (created_by = auth.uid());
create policy ws_delete on public.workspaces for delete using (created_by = auth.uid());
create policy wm_select on public.workspace_members for select
  using (workspace_id in (select public.user_workspace_ids(auth.uid())));
create policy wm_insert on public.workspace_members for insert with check (auth.uid() is not null);
create policy wm_delete on public.workspace_members for delete
  using (user_id = auth.uid() or workspace_id in (select public.user_admin_workspace_ids(auth.uid())));
create policy tx_select on public.transactions for select
  using (public.is_workspace_member(workspace_id));
create policy tx_insert on public.transactions for insert
  with check (public.is_workspace_member(workspace_id));
create policy tx_update on public.transactions for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy tx_delete on public.transactions for delete
  using (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- Legacy public bucket plus its permissive PUBLIC INSERT policy, reproduced
-- exactly as observed live so the migration's replacement has a real positive
-- control to close.
insert into storage.buckets (id, name, public) values ('workspace-images', 'workspace-images', true);
create policy "Allow upload" on storage.objects
  for insert to public with check (bucket_id = 'workspace-images');
create policy workspace_images_public_read on storage.objects
  for select to public using (bucket_id = 'workspace-images');

create function public.test_assert(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then
    raise exception 'RECEIPT_ASSERT: %', message;
  end if;
end $$;
