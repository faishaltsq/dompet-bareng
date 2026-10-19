begin;
create or replace function public.qr_join_is_admin(p_workspace_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.workspaces where id=p_workspace_id and created_by=auth.uid())
 or exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role='admin');
$$;
create or replace function public.qr_join_registered() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and not coalesce(u.is_anonymous,true)
 and(nullif(u.email,'') is not null or u.raw_app_meta_data->>'provider'='google'));
$$;
create or replace function public.qr_join_enabled() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select value='true' from public.app_configs where key='qr_join_enabled'),false);
$$;
create or replace function public.qr_join_error(p_code text) returns jsonb
language sql immutable set search_path=pg_catalog as $$ select jsonb_build_object('ok',false,'code',p_code) $$;
create or replace function public.qr_join_request_view(p_id uuid) returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('id',r.id,'workspace_id',r.workspace_id,'wallet_name',w.name,'wallet_image_url',w.image_url,
 'requester_id',r.requester_id,'requester_display_name',p.display_name,'requester_avatar_url',p.avatar_url,
 'status',case when r.status='pending' and (i.revoked_at is not null or(i.kind='temporary' and i.expires_at<=clock_timestamp())) then 'expired' else r.status end,
 'created_at',r.created_at,'resolved_at',r.resolved_at,'reviewer_id',r.reviewer_id,
 'requester_is_member',exists(select 1 from public.workspace_members m where m.workspace_id=r.workspace_id and m.user_id=r.requester_id),
 'can_retry_at',case when r.status='rejected' then r.resolved_at+interval '5 minutes' else null end)
 from public.workspace_join_requests r join public.workspaces w on w.id=r.workspace_id
 join public.workspace_invites i on i.token=r.invite_token left join public.profiles p on p.id=r.requester_id where r.id=p_id;
$$;
create or replace function public.preview_workspace_invite(p_token text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v jsonb;
begin
 if p_token is null or p_token!~'^[0-9a-f]{32}$' then return public.qr_join_error('unavailable'); end if;
 select jsonb_build_object('wallet_name',w.name,'wallet_image_url',w.image_url,'kind',i.kind,'expires_at',i.expires_at) into v
 from public.workspace_invites i join public.workspaces w on w.id=i.workspace_id where i.token=p_token and i.revoked_at is null and(i.kind='static' or i.expires_at>clock_timestamp());
 if v is null then return public.qr_join_error('unavailable'); end if;
 if not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 return jsonb_build_object('ok',true,'value',v);
end $$;
create or replace function public.create_workspace_invite(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.workspace_invites;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if not public.qr_join_registered() then return public.qr_join_error('registered_account_required'); end if;
 if not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 perform pg_advisory_xact_lock(hashtextextended('qr-join:'||p_workspace_id::text,0));
 if not(public.qr_join_is_admin(p_workspace_id) or public.is_workspace_member(p_workspace_id)) then return public.qr_join_error('forbidden'); end if;
 insert into public.workspace_invites(workspace_id,created_by,kind,expires_at) values(p_workspace_id,auth.uid(),'temporary',clock_timestamp()+interval '7 days') returning * into i;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('token',i.token,'kind',i.kind,'expires_at',i.expires_at));
end $$;
create or replace function public.manage_workspace_qr(p_workspace_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.workspace_invites;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if not public.qr_join_registered() then return public.qr_join_error('registered_account_required'); end if;
 if p_workspace_id is null or p_action is null or p_action not in('get','enable','reset','disable') then return public.qr_join_error('invalid_input'); end if;
 if not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 perform pg_advisory_xact_lock(hashtextextended('qr-join:'||p_workspace_id::text,0));
 if not public.qr_join_is_admin(p_workspace_id) then return public.qr_join_error('forbidden'); end if;
 select * into i from public.workspace_invites where workspace_id=p_workspace_id and kind='static' and revoked_at is null;
 if p_action='get' then
  if i.token is null then return jsonb_build_object('ok',true,'value',jsonb_build_object('state','disabled')); end if;
  return jsonb_build_object('ok',true,'value',jsonb_build_object('state','active','invite',jsonb_build_object('token',i.token,'kind',i.kind,'expires_at',i.expires_at)));
 end if;
 if p_action='disable' then
  if i.token is not null then
   update public.workspace_invites set revoked_at=clock_timestamp() where token=i.token;
   update public.workspace_join_requests set status='expired',resolved_at=clock_timestamp() where invite_token=i.token and status='pending';
  end if;
  return jsonb_build_object('ok',true,'value',jsonb_build_object('state','disabled'));
 end if;
 if p_action='reset' and i.token is not null then
  update public.workspace_invites set revoked_at=clock_timestamp() where token=i.token;
  update public.workspace_join_requests set status='expired',resolved_at=clock_timestamp() where invite_token=i.token and status='pending';
  i.token:=null;
 end if;
 if i.token is null then
 insert into public.workspace_invites(workspace_id,created_by,kind,expires_at) values(p_workspace_id,auth.uid(),'static',null) returning * into i;
 end if;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('state','active','invite',jsonb_build_object('token',i.token,'kind',i.kind,'expires_at',i.expires_at)));
end $$;
create or replace function public.get_workspace_join_state(p_token text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.workspace_invites; rid uuid; v jsonb;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if p_token is null or p_token!~'^[0-9a-f]{32}$' then return public.qr_join_error('unavailable'); end if;
 select * into i from public.workspace_invites where token=p_token;
 if not found then return public.qr_join_error('unavailable'); end if;
 if public.is_workspace_member(i.workspace_id) then
  select jsonb_build_object('state','already_member','workspace_id',w.id,'wallet_name',w.name) into v from public.workspaces w where w.id=i.workspace_id;
  return jsonb_build_object('ok',true,'value',v);
 end if;
 if not public.qr_join_registered() then return public.qr_join_error('registered_account_required'); end if;
 select id into rid from public.workspace_join_requests where workspace_id=i.workspace_id and requester_id=auth.uid() order by created_at desc,id desc limit 1;
 if rid is not null then return jsonb_build_object('ok',true,'value',jsonb_build_object('state','request','request',public.qr_join_request_view(rid))); end if;
 if i.revoked_at is not null or(i.kind='temporary' and i.expires_at<=clock_timestamp()) then return public.qr_join_error('unavailable'); end if;
 if not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('state','available'));
end $$;
create or replace function public.submit_workspace_join_request(p_token text,p_retry boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare i public.workspace_invites; r public.workspace_join_requests; until_time timestamptz;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if not public.qr_join_registered() then return public.qr_join_error('registered_account_required'); end if;
 if p_token is null or p_token!~'^[0-9a-f]{32}$' or p_retry is null then return public.qr_join_error('invalid_input'); end if;
 if not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 select * into i from public.workspace_invites where token=p_token;
 if not found then return public.qr_join_error('unavailable'); end if;
 perform pg_advisory_xact_lock(hashtextextended('qr-join:'||i.workspace_id::text,0));
 select * into i from public.workspace_invites where token=p_token;
 if not found or i.revoked_at is not null or(i.kind='temporary' and i.expires_at<=clock_timestamp()) then return public.qr_join_error('unavailable'); end if;
 if public.is_workspace_member(i.workspace_id) then return public.get_workspace_join_state(p_token); end if;
 update public.workspace_join_requests r0 set status='expired',resolved_at=clock_timestamp()
 where r0.workspace_id=i.workspace_id and r0.requester_id=auth.uid() and r0.status='pending'
 and exists(select 1 from public.workspace_invites s where s.token=r0.invite_token and(s.revoked_at is not null or(s.kind='temporary' and s.expires_at<=clock_timestamp())));
 select * into r from public.workspace_join_requests where workspace_id=i.workspace_id and requester_id=auth.uid() order by (status='pending') desc,created_at desc,id desc limit 1;
 if r.id is not null and (r.status='pending' or not p_retry) then
  return jsonb_build_object('ok',true,'value',jsonb_build_object('state','request','request',public.qr_join_request_view(r.id)));
 end if;
 select max(resolved_at)+interval '5 minutes' into until_time from public.workspace_join_requests where workspace_id=i.workspace_id and requester_id=auth.uid() and status='rejected';
 if until_time>clock_timestamp() then return jsonb_build_object('ok',false,'code','cooldown','retry_after_seconds',greatest(0,ceil(extract(epoch from until_time-clock_timestamp()))::integer)); end if;
 insert into public.workspace_join_requests(workspace_id,requester_id,invite_token,created_at) values(i.workspace_id,auth.uid(),p_token,clock_timestamp()) returning * into r;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('state','request','request',public.qr_join_request_view(r.id)));
end $$;
create or replace function public.list_my_workspace_join_requests(p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare items jsonb; n integer; c jsonb;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if p_limit is null or p_limit<1 or p_limit>50 or((p_before_at is null)<>(p_before_id is null)) then return public.qr_join_error('invalid_input'); end if;
 select coalesce(jsonb_agg(v order by created_at desc,id desc),'[]'::jsonb) into items from(
  select r.id,r.created_at,public.qr_join_request_view(r.id) v from public.workspace_join_requests r where requester_id=auth.uid() and(p_before_at is null or(r.created_at,r.id)<(p_before_at,p_before_id)) order by created_at desc,id desc limit p_limit) x;
 select count(*) into n from public.workspace_join_requests r join public.workspace_invites i on i.token=r.invite_token where r.requester_id=auth.uid() and r.status='pending' and i.revoked_at is null and(i.kind='static' or i.expires_at>clock_timestamp());
 if jsonb_array_length(items)=p_limit then c:=jsonb_build_object('id',items->(p_limit-1)->'id','created_at',items->(p_limit-1)->'created_at'); end if;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('items',items,'pending_count',n,'next_cursor',c));
end $$;
create or replace function public.list_workspace_join_requests(p_workspace_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare items jsonb; n integer; c jsonb;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if not public.qr_join_is_admin(p_workspace_id) then return public.qr_join_error('forbidden'); end if;
 if p_limit is null or p_limit<1 or p_limit>50 or((p_before_at is null)<>(p_before_id is null)) then return public.qr_join_error('invalid_input'); end if;
 select coalesce(jsonb_agg(v order by created_at desc,id desc),'[]'::jsonb) into items from(
  select r.id,r.created_at,public.qr_join_request_view(r.id) v from public.workspace_join_requests r join public.workspace_invites i on i.token=r.invite_token
  where r.workspace_id=p_workspace_id and r.status='pending' and i.revoked_at is null and(i.kind='static' or i.expires_at>clock_timestamp())
  and(p_before_at is null or(r.created_at,r.id)<(p_before_at,p_before_id)) order by r.created_at desc,r.id desc limit p_limit) x;
 select count(*) into n from public.workspace_join_requests r join public.workspace_invites i on i.token=r.invite_token where r.workspace_id=p_workspace_id and r.status='pending' and i.revoked_at is null and(i.kind='static' or i.expires_at>clock_timestamp());
 if jsonb_array_length(items)=p_limit then c:=jsonb_build_object('id',items->(p_limit-1)->'id','created_at',items->(p_limit-1)->'created_at'); end if;
 return jsonb_build_object('ok',true,'value',jsonb_build_object('items',items,'pending_count',n,'next_cursor',c));
end $$;
create or replace function public.decide_workspace_join_request(p_request_id uuid,p_decision text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.workspace_join_requests; i public.workspace_invites;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 if p_decision is null or p_decision not in('approved','rejected') then return public.qr_join_error('invalid_input'); end if;
 if p_decision='approved' and not public.qr_join_enabled() then return public.qr_join_error('feature_disabled'); end if;
 select * into r from public.workspace_join_requests where id=p_request_id;
 if not found then return public.qr_join_error('not_found'); end if;
 perform pg_advisory_xact_lock(hashtextextended('qr-join:'||r.workspace_id::text,0));
 if not public.qr_join_is_admin(r.workspace_id) then return public.qr_join_error('forbidden'); end if;
 select * into i from public.workspace_invites where token=r.invite_token;
 if i.token is null or i.revoked_at is not null or(i.kind='temporary' and i.expires_at<=clock_timestamp()) then
  update public.workspace_join_requests set status='expired',resolved_at=clock_timestamp() where id=p_request_id and status='pending';
 else
  update public.workspace_join_requests set status=p_decision,resolved_at=clock_timestamp(),reviewer_id=auth.uid()
  where id=p_request_id and status = 'pending' returning * into r;
  if found and p_decision='approved' then
   insert into public.workspace_members(workspace_id,user_id,role) values(r.workspace_id,r.requester_id,'member') on conflict(workspace_id,user_id) do nothing;
  end if;
 end if;
 return jsonb_build_object('ok',true,'value',public.qr_join_request_view(p_request_id));
end $$;
create or replace function public.cancel_workspace_join_request(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.workspace_join_requests;
begin
 if auth.uid() is null then return public.qr_join_error('login_required'); end if;
 select * into r from public.workspace_join_requests where id=p_request_id and requester_id=auth.uid();
 if not found then return public.qr_join_error('not_found'); end if;
 perform pg_advisory_xact_lock(hashtextextended('qr-join:'||r.workspace_id::text,0));
 update public.workspace_join_requests set status='cancelled',resolved_at=clock_timestamp() where id=p_request_id and requester_id=auth.uid() and status='pending';
 return jsonb_build_object('ok',true,'value',public.qr_join_request_view(p_request_id));
end $$;
-- Explicitly override any Supabase default grants, including direct anon grants.
do $$ declare f record; begin
 for f in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace and(proname like 'qr_join_%' or proname in('preview_workspace_invite','create_workspace_invite','manage_workspace_qr','get_workspace_join_state','submit_workspace_join_request','list_my_workspace_join_requests','list_workspace_join_requests','decide_workspace_join_request','cancel_workspace_join_request')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.proname not like 'qr_join_%' or f.proname='qr_join_is_admin' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  if f.proname='preview_workspace_invite' then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;
commit;
