-- Expense Splits & Participants migration — dompet-bareng
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  transaction_id uuid references public.transactions(id) on delete cascade,
  title text not null,
  total_amount numeric(15,2) not null check (total_amount > 0),
  paid_by uuid references auth.users(id) on delete set null,
  split_type text not null check (split_type in ('equal', 'exact', 'percentage')),
  created_at timestamptz default now() not null
);

create table if not exists public.split_participants (
  id uuid primary key default gen_random_uuid(),
  split_id uuid references public.expense_splits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text not null,
  owed_amount numeric(15,2) not null check (owed_amount >= 0),
  is_settled boolean default false not null,
  settled_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.expense_splits enable row level security;
alter table public.split_participants enable row level security;

-- Policies for expense_splits
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'expense_splits' and policyname = 'es_select') then
    create policy "es_select" on public.expense_splits for select
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'expense_splits' and policyname = 'es_insert') then
    create policy "es_insert" on public.expense_splits for insert
      with check (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'expense_splits' and policyname = 'es_update') then
    create policy "es_update" on public.expense_splits for update
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'expense_splits' and policyname = 'es_delete') then
    create policy "es_delete" on public.expense_splits for delete
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;
end $$;

-- Policies for split_participants
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'split_participants' and policyname = 'sp_select') then
    create policy "sp_select" on public.split_participants for select
      using (split_id in (
        select id from public.expense_splits
        where workspace_id in (select public.user_workspace_ids(auth.uid()))
      ));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'split_participants' and policyname = 'sp_insert') then
    create policy "sp_insert" on public.split_participants for insert
      with check (split_id in (
        select id from public.expense_splits
        where workspace_id in (select public.user_workspace_ids(auth.uid()))
      ));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'split_participants' and policyname = 'sp_update') then
    create policy "sp_update" on public.split_participants for update
      using (split_id in (
        select id from public.expense_splits
        where workspace_id in (select public.user_workspace_ids(auth.uid()))
      ));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'split_participants' and policyname = 'sp_delete') then
    create policy "sp_delete" on public.split_participants for delete
      using (split_id in (
        select id from public.expense_splits
        where workspace_id in (select public.user_workspace_ids(auth.uid()))
      ));
  end if;
end $$;
