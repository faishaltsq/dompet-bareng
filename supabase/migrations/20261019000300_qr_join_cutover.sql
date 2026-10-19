begin;
-- Preserve existing SELECT/DELETE behavior, but reject unknown ALL policies that
-- would silently act as an alternative admission/preview route.
do $$ declare p record; begin
 if exists(select 1 from pg_policies where schemaname='public' and tablename in('workspace_members','workspaces') and cmd='ALL') then
  raise exception 'Review unexpected ALL policy before QR authorization cutover';
 end if;
 for p in select policyname,tablename from pg_policies where schemaname='public' and
 ((tablename='workspace_members' and cmd='INSERT') or(tablename='workspaces' and cmd='SELECT') or tablename in('workspace_invites','workspace_join_requests')) loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
-- The old helpers accepted arbitrary user IDs over PostgREST. Actor binding
-- closes that enumeration path without changing legitimate policy callers.
create or replace function public.user_workspace_ids(uid uuid) returns setof uuid
language sql stable security definer set search_path=pg_catalog,public as $$
 select workspace_id from public.workspace_members where user_id=uid and uid=auth.uid();
$$;
create or replace function public.user_admin_workspace_ids(uid uuid) returns setof uuid
language sql stable security definer set search_path=pg_catalog,public as $$
 select workspace_id from public.workspace_members where user_id=uid and uid=auth.uid() and role='admin';
$$;
revoke all on function public.user_workspace_ids(uuid),public.user_admin_workspace_ids(uuid) from public,anon,authenticated;
grant execute on function public.user_workspace_ids(uuid),public.user_admin_workspace_ids(uuid) to authenticated;
create policy ws_select on public.workspaces for select to authenticated using(created_by=auth.uid() or public.is_workspace_member(id));
create policy wm_insert_owner_bootstrap on public.workspace_members for insert to authenticated with check(
 user_id=auth.uid() and role='admin' and exists(select 1 from public.workspaces w where w.id=workspace_members.workspace_id and w.created_by=auth.uid())
);
revoke all on public.workspace_invites from anon,authenticated;
grant select on public.workspace_invites to authenticated;
create policy qr_invite_read on public.workspace_invites for select to authenticated using(
 public.qr_join_is_admin(workspace_id) or(created_by=auth.uid() and kind='temporary' and public.is_workspace_member(workspace_id))
);
revoke all on public.workspace_join_requests from anon,authenticated;
grant select on public.workspace_join_requests to authenticated;
create policy qr_request_read on public.workspace_join_requests for select to authenticated using(requester_id=auth.uid() or public.qr_join_is_admin(workspace_id));
-- wm_select/wm_delete/invite_select carry no role clause, so anon still reaches
-- policy evaluation. Revoking the helpers above would make that raise mid-policy;
-- drop the table grant too so the denial happens at the privilege check, matching
-- the two tables above and returning a plain permission error instead of a leak.
revoke select on public.workspace_members from anon;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='workspace_join_requests') then
  alter publication supabase_realtime add table public.workspace_join_requests;
 end if;
end $$;
-- Enabling admission is a separately authorized release operation. Never
-- resurrect the unrestricted member INSERT policy as a rollback.
commit;
