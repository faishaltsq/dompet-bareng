begin;
alter table public.workspace_invites add column if not exists kind text not null default 'temporary', add column if not exists revoked_at timestamptz;
alter table public.workspace_invites alter column expires_at drop not null;
alter table public.workspace_invites add constraint workspace_invites_kind_check check(kind in ('temporary','static')),
 add constraint workspace_invites_lifecycle_check check((kind='static' and expires_at is null) or (kind='temporary' and expires_at is not null)),
 add constraint workspace_invites_token_workspace_unique unique(token,workspace_id);
create unique index workspace_invites_active_static_unique on public.workspace_invites(workspace_id) where kind='static' and revoked_at is null;
create index workspace_invites_wallet_kind_created on public.workspace_invites(workspace_id,kind,created_at desc);
create table public.workspace_join_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 invite_token text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','expired')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 reviewer_id uuid references auth.users(id) on delete set null,
 constraint workspace_join_request_source_fk foreign key(invite_token,workspace_id) references public.workspace_invites(token,workspace_id) on delete cascade,
 constraint workspace_join_request_resolution_check check((status='pending' and resolved_at is null and reviewer_id is null) or(status<>'pending' and resolved_at is not null)),
 constraint workspace_join_request_reviewer_check check(status in('approved','rejected') or reviewer_id is null)
);
create unique index workspace_join_requests_one_pending on public.workspace_join_requests(workspace_id,requester_id) where status='pending';
create index workspace_join_requests_wallet_pending on public.workspace_join_requests(workspace_id,created_at desc,id desc) where status='pending';
create index workspace_join_requests_requester_recent on public.workspace_join_requests(requester_id,created_at desc,id desc);
alter table public.workspace_join_requests enable row level security;
revoke all on public.workspace_join_requests from anon,authenticated;
insert into public.app_configs(key,value,description) values('qr_join_enabled','false','Server gate for invitation admission') on conflict(key) do nothing;
commit;
