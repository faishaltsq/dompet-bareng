-- Kill switch coverage for qr_join_enabled=false.
-- The switch must stop NEW admissions (approval and submission) while still
-- allowing cleanup (reject) and while both entrypoints agree on dead tokens.
insert into public.workspace_join_requests(workspace_id,requester_id,invite_token,created_at)
values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','0123456789abcdef0123456789abcdef',clock_timestamp());

-- Both entrypoints must agree on a DEAD token even with the flag off.
begin;
update public.app_configs set value='false' where key='qr_join_enabled';
set local role authenticated;
do $$ declare begin
 perform set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000005"}',true);
 perform public.test_assert((public.preview_workspace_invite('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')->>'code')='unavailable','preview dead token stays unavailable with flag off');
 perform public.test_assert((public.get_workspace_join_state('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')->>'code')='unavailable','get_state dead token stays unavailable with flag off');
end $$;
reset role;
rollback;

begin;
update public.app_configs set value='false' where key='qr_join_enabled';
set local role authenticated;
do $$ declare rid uuid; a jsonb; begin
 -- approval is the admission step and must be blocked
 perform set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001"}',true);
 rid:=(public.list_workspace_join_requests('10000000-0000-4000-8000-000000000001')#>>'{value,items,0,id}')::uuid;
 perform public.test_assert(rid is not null,'pending request fixture resolved for admin');
 perform public.test_assert((public.decide_workspace_join_request(rid,'approved')->>'code')='feature_disabled','kill switch blocks approval-driven admission');
 perform public.test_assert(not exists(select 1 from public.workspace_members where workspace_id='10000000-0000-4000-8000-000000000001' and user_id='20000000-0000-4000-8000-000000000004'),'blocked approval grants no membership');
 -- cleanup must still work while the switch is off
 perform public.test_assert((public.decide_workspace_join_request(rid,'rejected')#>>'{value,status}')='rejected','kill switch still allows rejecting for cleanup');
 -- submission of a new request must be blocked
 perform set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000005"}',true);
 perform public.test_assert((public.submit_workspace_join_request('0123456789abcdef0123456789abcdef',false)->>'code')='feature_disabled','kill switch blocks new submission');
 -- a live token with the flag off reads as feature_disabled on both entrypoints
 perform public.test_assert((public.preview_workspace_invite('0123456789abcdef0123456789abcdef')->>'code')='feature_disabled','preview live token is feature_disabled with flag off');
 a:=public.get_workspace_join_state('0123456789abcdef0123456789abcdef');
 perform public.test_assert(a->>'code'='feature_disabled','get_state live token is feature_disabled with flag off');
end $$;
reset role;
rollback;

-- With the switch back on, both entrypoints must agree on the same dead token.
begin;
set local role authenticated;
do $$ declare begin
 perform set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000005"}',true);
 perform public.test_assert((public.preview_workspace_invite('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')->>'code')='unavailable','preview dead token unavailable with flag on');
 perform public.test_assert((public.get_workspace_join_state('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')->>'code')='unavailable','get_state dead token unavailable with flag on');
end $$;
reset role;
rollback;
