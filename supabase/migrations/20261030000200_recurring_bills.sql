-- Recurring Bills migration — dompet-bareng
create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  amount numeric(15,2) not null check (amount > 0),
  category text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  due_day integer not null check (due_day between 1 and 31),
  next_due_date date not null,
  last_paid_at timestamptz,
  is_active boolean default true not null,
  auto_remind boolean default true not null,
  created_at timestamptz default now() not null
);

alter table public.recurring_bills enable row level security;

-- Policies for recurring_bills
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'recurring_bills' and policyname = 'rb_select') then
    create policy "rb_select" on public.recurring_bills for select
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'recurring_bills' and policyname = 'rb_insert') then
    create policy "rb_insert" on public.recurring_bills for insert
      with check (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'recurring_bills' and policyname = 'rb_update') then
    create policy "rb_update" on public.recurring_bills for update
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'recurring_bills' and policyname = 'rb_delete') then
    create policy "rb_delete" on public.recurring_bills for delete
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;
end $$;
