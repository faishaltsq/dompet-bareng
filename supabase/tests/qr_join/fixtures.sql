insert into auth.users(id,email,is_anonymous,raw_app_meta_data)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=6 then null else 'fixture'||i||'@example.invalid' end,i=6,'{"provider":"email"}'::jsonb from generate_series(1,7) i
on conflict(id) do nothing;
insert into public.profiles(id,display_name,email) select id,'Fixture '||email,email from auth.users on conflict(id) do nothing;
insert into public.workspaces(id,name,created_by,created_at) values
('10000000-0000-4000-8000-000000000001','Wallet A','20000000-0000-4000-8000-000000000001','2026-01-01'),
('10000000-0000-4000-8000-000000000002','Wallet B','20000000-0000-4000-8000-000000000005','2026-01-01') on conflict(id) do nothing;
insert into public.workspace_members(workspace_id,user_id,role,joined_at) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','admin','2026-01-01'),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','admin','2026-01-01'),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','member','2026-01-01'),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','admin','2026-01-01') on conflict do nothing;
insert into public.workspace_invites(token,workspace_id,created_by,expires_at,created_at) values
('0123456789abcdef0123456789abcdef','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2100-01-01','2026-01-01'),
('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005','2100-01-01','2026-01-01'),
('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2000-01-01','1999-01-01') on conflict do nothing;
insert into public.transactions(id,workspace_id,amount) values('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',25000) on conflict do nothing;
