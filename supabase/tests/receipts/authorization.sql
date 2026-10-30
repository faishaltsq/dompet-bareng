-- Authorization proofs for private transaction receipts.
-- Each denial is asserted separately with its expected SQLSTATE.

-- =========================================================================
-- 1. Anonymous access is closed
-- =========================================================================
begin;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select public.test_assert(
  not has_table_privilege('anon', 'storage.objects', 'INSERT'),
  'anon has no storage INSERT grant'
);
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('workspace-images', 'anon_after_1750000009999.jpg', null)$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000009.jpg', null)$s$, '42501');
select public.test_assert_count(
  (select count(*) from storage.objects where name like 'anon_after%'),
  0,
  'no anonymous object was created after the migration'
);
rollback;

-- =========================================================================
-- 2. A workspace member uploads to its own prefix and reads it back
-- =========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);

insert into storage.objects (bucket_id, name, owner, owner_id)
values (
  'transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000009.jpg',
  auth.uid(), auth.uid()::text
);
select public.test_assert_count(
  (select count(*) from storage.objects where name like '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000009.%'),
  1,
  'member uploaded its own receipt'
);
select public.test_assert_count(
  (select count(*) from storage.objects where bucket_id = 'transaction-receipts'),
  1,
  'member can read the workspace receipt (signed-URL SELECT path)'
);

-- A member of the same workspace can read another member's receipt.
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002"}', true);
select public.test_assert_count(
  (select count(*) from storage.objects where bucket_id = 'transaction-receipts'),
  1,
  'same-wallet member can read the receipt'
);
rollback;

-- =========================================================================
-- 3. Outsiders and other-wallet members cannot read or write
-- =========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);
insert into storage.objects (bucket_id, name, owner, owner_id)
values (
  'transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000009.jpg',
  auth.uid(), auth.uid()::text
);

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000006"}', true);
select public.test_assert_count(
  (select count(*) from storage.objects where bucket_id = 'transaction-receipts'),
  0,
  'outsider cannot read the receipt'
);
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000006/30000000-0000-4000-8000-000000000010.jpg',
  '20000000-0000-4000-8000-000000000006')$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000006/30000000-0000-4000-8000-000000000011.jpg',
  '20000000-0000-4000-8000-000000000006')$s$, '42501');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000005"}', true);
select public.test_assert_count(
  (select count(*) from storage.objects where bucket_id = 'transaction-receipts'),
  0,
  'other-wallet member cannot read the receipt'
);
rollback;

-- =========================================================================
-- 4. An uploader cannot write into another member's prefix or a foreign wallet
-- =========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);

select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000012.jpg',
  '20000000-0000-4000-8000-000000000004')$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000013.jpg',
  '20000000-0000-4000-8000-000000000004')$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/../../../etc/passwd.jpg',
  '20000000-0000-4000-8000-000000000004')$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000014.gif',
  '20000000-0000-4000-8000-000000000004')$s$, '42501');
select public.test_reject($s$insert into storage.objects (bucket_id, name, owner_id)
  values ('transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/not-a-uuid.jpg',
  '20000000-0000-4000-8000-000000000004')$s$, '42501');
rollback;

-- =========================================================================
-- 5. Attached objects cannot be deleted; unreferenced ones can
-- =========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);

insert into storage.objects (bucket_id, name, owner, owner_id)
values (
  'transaction-receipts',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000020.jpg',
  auth.uid(), auth.uid()::text
);
insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
values (
  '30000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000020.jpg'
);

delete from storage.objects
where name = '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000020.jpg';
select public.test_assert_count(
  (select count(*) from storage.objects where name like '%30000000-0000-4000-8000-000000000020.jpg'),
  1,
  'an attached receipt object is not deletable'
);

-- Deleting the transaction first makes the path unreferenced, then cleanup runs.
delete from public.transactions where id = '30000000-0000-4000-8000-000000000020';
delete from storage.objects
where name = '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000020.jpg';
select public.test_assert_count(
  (select count(*) from storage.objects where name like '%30000000-0000-4000-8000-000000000020.jpg'),
  0,
  'an unreferenced receipt object is deletable'
);
rollback;

-- =========================================================================
-- 6. The receipt_path CHECK accepts only a row-consistent canonical path
-- =========================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);

insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
values (
  '30000000-0000-4000-8000-000000000030', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000030.webp'
);
select public.test_assert_count(
  (select count(*) from public.transactions where id = '30000000-0000-4000-8000-000000000030'),
  1,
  'canonical receipt path accepted'
);

select public.test_reject($s$insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
  values ('30000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000099.jpg')$s$, '23514');
select public.test_reject($s$insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
  values ('30000000-0000-4000-8000-000000000032', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000032.jpg')$s$, '23514');
select public.test_reject($s$insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
  values ('30000000-0000-4000-8000-000000000033', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000033.gif')$s$, '23514');
select public.test_reject($s$insert into public.transactions (id, workspace_id, user_id, type, amount, category, receipt_path)
  values ('30000000-0000-4000-8000-000000000034', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi',
  'not-a-uuid/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000034.jpg')$s$, '23514');
select public.test_reject($s$insert into public.transactions (id, workspace_id, user_id, type, amount, category, image_url, receipt_path)
  values ('30000000-0000-4000-8000-000000000035', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'expense', 15000, 'Transportasi', 'https://fixture.invalid/a.jpg',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/30000000-0000-4000-8000-000000000035.jpg')$s$, '23514');

-- Historical rows with a null receipt_path and a populated image_url stay valid.
select public.test_assert_count(
  (select count(*) from public.transactions where image_url is not null and receipt_path is null),
  1,
  'legacy image_url row remains valid'
);
rollback;

-- =========================================================================
-- 7. Legacy public bucket: reads preserved, authenticated writes preserved
-- =========================================================================
begin;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select public.test_assert_count(
  (select count(*) from storage.objects where bucket_id = 'workspace-images'),
  2,
  'legacy public reads are preserved'
);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000004"}', true);
insert into storage.objects (bucket_id, name, owner, owner_id)
values ('workspace-images',
  '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000004/receipt_1750000000002.jpg',
  auth.uid(), auth.uid()::text);
select public.test_assert_count(
  (select count(*) from storage.objects where name like '%receipt_1750000000002.jpg'),
  1,
  'authenticated legacy wallet-image/receipt upload still works'
);
select public.test_assert_count(
  (select count(*) from public.transactions),
  1,
  'existing member financial reads are unchanged'
);
rollback;

-- =========================================================================
-- 8. Bucket configuration and policy inventory
-- =========================================================================
select public.test_assert(
  (select not public from storage.buckets where id = 'transaction-receipts'),
  'transaction-receipts is private'
);
select public.test_assert(
  (select file_size_limit = 2097152 from storage.buckets where id = 'transaction-receipts'),
  'transaction-receipts enforces the 2 MiB limit'
);
select public.test_assert(
  (select allowed_mime_types @> array['image/jpeg','image/png','image/webp']
     and array_length(allowed_mime_types, 1) = 3
   from storage.buckets where id = 'transaction-receipts'),
  'transaction-receipts allows only the three permitted MIME types'
);
select public.test_assert(
  (select public from storage.buckets where id = 'workspace-images'),
  'workspace-images stays public for legacy URLs'
);
select public.test_assert_count(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('receipt_member_select','receipt_owner_insert','receipt_unreferenced_delete')),
  3,
  'all three receipt policies exist'
);
select public.test_assert_count(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow upload'),
  0,
  'the permissive legacy PUBLIC INSERT policy is gone'
);
select public.test_assert_count(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'workspace_images_authenticated_insert' and cmd = 'INSERT'),
  1,
  'the authenticated legacy INSERT policy is installed'
);
select public.test_assert_count(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'receipt_%' and cmd = 'UPDATE'),
  0,
  'no UPDATE policy exists for receipt objects'
);
select public.test_assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'transaction-receipts'),
  'no receipt object was left behind by the proofs'
);
