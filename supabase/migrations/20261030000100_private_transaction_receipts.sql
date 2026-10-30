-- Private transaction receipts — dompet-bareng
--
-- Adds a private bucket for new receipt attachments plus a nullable receipt_path
-- on transactions. Existing public workspace-images objects and their URLs are
-- untouched: historical receipts and wallet photos keep working.
--
-- Also replaces the known permissive PUBLIC INSERT policy on workspace-images
-- ("Allow upload") with an authenticated equivalent. Public reads and the
-- existing authenticated legacy upload path are preserved.
--
-- Replay safe: guarded column/constraint creation, named policy drop/create
-- pairs, and a bucket that is created only when absent. An existing bucket with
-- unexpected settings raises instead of silently exposing new images.

-- =========================================================================
-- A. transactions.receipt_path
-- =========================================================================
alter table public.transactions
  add column if not exists receipt_path text;

-- A non-null receipt path must name this exact row: workspace/user/transaction
-- UUIDs with one permitted extension, and no legacy public image alongside.
-- Casts run only inside the branch whose regex already matched, so a malformed
-- path raises a check violation instead of an invalid-uuid error.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_receipt_path_matches_row'
  ) then
    alter table public.transactions
      add constraint transactions_receipt_path_matches_row check (
        case
          when receipt_path is null then true
          when receipt_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' then false
          else
            image_url is null
            and split_part(receipt_path, '/', 1)::uuid = workspace_id
            and split_part(receipt_path, '/', 2)::uuid = user_id
            -- The third segment carries the extension, so strip it before the cast.
            and left(split_part(receipt_path, '/', 3), 36)::uuid = id
        end
      );
  end if;
end $$;

-- =========================================================================
-- B. Private bucket transaction-receipts
-- =========================================================================
do $$
declare is_public boolean;
begin
  select b.public into is_public
  from storage.buckets b where b.id = 'transaction-receipts';

  if found then
    if is_public then
      raise exception 'Bucket transaction-receipts already exists as PUBLIC; refusing to continue';
    end if;
  else
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'transaction-receipts', 'transaction-receipts', false, 2097152,
      array['image/jpeg', 'image/png', 'image/webp']
    );
  end if;
end $$;

-- =========================================================================
-- C. Storage policies for transaction-receipts
--    Path shape: <workspace uuid>/<uploader uuid>/<transaction uuid>.<ext>
--    Membership is resolved through the existing definer helper so the policy
--    does not depend on a client-supplied workspace id.
-- =========================================================================
drop policy if exists receipt_member_select on storage.objects;
create policy receipt_member_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

drop policy if exists receipt_owner_insert on storage.objects;
create policy receipt_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'transaction-receipts'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and split_part(name, '/', 2)::uuid = auth.uid()
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
  );

-- An object may only be removed once no transaction row references it. Deleting
-- the transaction first makes the path unreferenced; a failed cleanup is
-- retried later rather than being forced through a service key.
drop policy if exists receipt_unreferenced_delete on storage.objects;
create policy receipt_unreferenced_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'transaction-receipts'
    and public.is_workspace_member(split_part(name, '/', 1)::uuid)
    and not exists (
      select 1 from public.transactions t where t.receipt_path = storage.objects.name
    )
  );

-- No UPDATE policy: a saved receipt image is immutable for its save intent.

-- =========================================================================
-- D. Close anonymous upload on the legacy public bucket
--    The permissive INSERT policy alone was not the whole gap: anon also held
--    the storage.objects INSERT grant, so a policy swap without the grant
--    revocation would still leave the path open. Both are closed here; SELECT
--    stays granted because the bucket is public and legacy URLs must keep
--    resolving. No UPDATE/DELETE is granted.
-- =========================================================================
revoke insert, update, delete on table storage.objects from anon;

drop policy if exists "Allow upload" on storage.objects;
drop policy if exists workspace_images_authenticated_insert on storage.objects;
create policy workspace_images_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workspace-images');
