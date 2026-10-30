-- Pre-migration positive control. Proves the legacy PUBLIC INSERT policy really
-- allowed an anonymous upload with the INSERT grant present, so the denial
-- asserted after the migration is a real change and not a grantless fixture.
--
-- Run this BEFORE applying the migration. It must pass on the baseline.

begin;
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select public.test_assert(
  has_table_privilege('anon', 'storage.objects', 'INSERT'),
  'baseline: anon must hold the storage.objects INSERT grant'
);
select public.test_assert(
  not has_table_privilege('anon', 'public.transactions', 'INSERT'),
  'baseline: anon must not hold a transactions INSERT grant'
);

insert into storage.objects (bucket_id, name, owner_id)
values ('workspace-images', 'anon_probe_1750000009999.jpg', null);

select public.test_assert_count(
  (select count(*) from storage.objects where name = 'anon_probe_1750000009999.jpg'),
  1,
  'baseline: permissive PUBLIC INSERT policy must accept an anonymous upload'
);

rollback;
