-- Savings Goals & Contributions migration — dompet-bareng
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  target_amount numeric(15,2) not null check (target_amount > 0),
  current_amount numeric(15,2) default 0.00 not null check (current_amount >= 0),
  target_date date,
  icon text default 'flag' not null,
  color text default '#9E6747' not null,
  is_achieved boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references public.savings_goals(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(15,2) not null check (amount > 0),
  note text,
  created_at timestamptz default now() not null
);

alter table public.savings_goals enable row level security;
alter table public.savings_goal_contributions enable row level security;

-- Policies for savings_goals
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'savings_goals' and policyname = 'sg_select') then
    create policy "sg_select" on public.savings_goals for select
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goals' and policyname = 'sg_insert') then
    create policy "sg_insert" on public.savings_goals for insert
      with check (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goals' and policyname = 'sg_update') then
    create policy "sg_update" on public.savings_goals for update
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goals' and policyname = 'sg_delete') then
    create policy "sg_delete" on public.savings_goals for delete
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;
end $$;

-- Policies for savings_goal_contributions
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'savings_goal_contributions' and policyname = 'sgc_select') then
    create policy "sgc_select" on public.savings_goal_contributions for select
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goal_contributions' and policyname = 'sgc_insert') then
    create policy "sgc_insert" on public.savings_goal_contributions for insert
      with check (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goal_contributions' and policyname = 'sgc_update') then
    create policy "sgc_update" on public.savings_goal_contributions for update
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'savings_goal_contributions' and policyname = 'sgc_delete') then
    create policy "sgc_delete" on public.savings_goal_contributions for delete
      using (workspace_id in (select public.user_workspace_ids(auth.uid())));
  end if;
end $$;
