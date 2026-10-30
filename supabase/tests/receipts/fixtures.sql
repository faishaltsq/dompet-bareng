-- Synthetic actors and rows. UUIDs are fixed so the authorization script can
-- name them literally.
--
--   workspace A 10000000-0000-4000-8000-000000000001  (member 20000000-...-000000000004)
--   workspace B 10000000-0000-4000-8000-000000000002  (member 20000000-...-000000000005)
--   admin       20000000-0000-4000-8000-000000000002
--   outsider    20000000-0000-4000-8000-000000000006
--   transaction 30000000-0000-4000-8000-000000000003

insert into auth.users (id, email) values
  ('20000000-0000-4000-8000-000000000002', 'admin@fixture.invalid'),
  ('20000000-0000-4000-8000-000000000004', 'member-a@fixture.invalid'),
  ('20000000-0000-4000-8000-000000000005', 'member-b@fixture.invalid'),
  ('20000000-0000-4000-8000-000000000006', 'outsider@fixture.invalid')
on conflict (id) do nothing;

insert into public.workspaces (id, name, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'Wallet A', '20000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000002', 'Wallet B', '20000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'admin'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'member'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005', 'admin')
on conflict do nothing;

-- Legacy rows that must survive the migration untouched.
insert into public.transactions (id, workspace_id, user_id, type, amount, category, image_url) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000004', 'expense', 25000, 'Makan & Minum',
   'https://fixture.invalid/storage/v1/object/public/workspace-images/legacy/receipt_1.jpg')
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name, owner, owner_id) values
  ('workspace-images', 'workspace_10000000-0000-4000-8000-000000000001_1750000000000.jpg',
   '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002'),
  ('workspace-images', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/receipt_1750000000001.jpg',
   '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004')
on conflict do nothing;
