begin;
insert into auth.users(id,email) select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'perf'||i||'@example.invalid' from generate_series(1,10000)i;
insert into public.workspace_join_requests(id,workspace_id,requester_id,invite_token,created_at)
select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'0123456789abcdef0123456789abcdef','2026-01-01'::timestamptz+i*interval '1 second' from generate_series(1,10000)i;
analyze public.workspace_join_requests;
select public.test_assert(exists(select 1 from pg_indexes where indexname='workspace_join_requests_wallet_pending'),'pending query index required');
do $$ declare plan jsonb; begin
 execute $q$explain(analyze,format json) select id,created_at from public.workspace_join_requests where workspace_id='10000000-0000-4000-8000-000000000001' and status='pending' order by created_at desc,id desc limit 25$q$ into plan;
 perform public.test_assert(plan::text like '%workspace_join_requests_wallet_pending%','pending query uses ordered index at realistic volume');
 raise notice 'QR pending query execution time: % ms',plan->0->>'Execution Time';
end $$;
drop index public.workspace_join_requests_wallet_pending;
select public.test_reject($q$select public.test_assert(exists(select 1 from pg_indexes where indexname='workspace_join_requests_wallet_pending'),'pending query index required')$q$,'P0001');
rollback;
