-- Hardening app_configs + update_latest_apk — dompet-bareng
-- Jalankan di Supabase SQL Editor sebagai postgres.
--
-- Masalah yang diperbaiki:
--   1. app_configs punya policy SELECT `using(true)` dan terbukti menerima
--      UPDATE dari anon (probe PATCH balas HTTP 200). Siapa pun yang punya
--      key publishable — sudah ter-inline di bundle APK — bisa menimpa
--      ai_api_key, latest_apk_url, dan seluruh isi tabel.
--   2. Kolom ai_api_key ikut terbaca anon lewat select key,value.
--   3. update_latest_apk membandingkan p_secret terhadap literal yang
--      hardcoded di badan fungsi, sehingga tidak bisa dirotasi tanpa
--      mengganti fungsi, dan berisiko ikut tersimpan di mana-mana.
--
-- Tidak di sini (butuh keputusan tersendiri): pemindahan ai_api_key ke
-- tabel terpisah. Cukup disembunyikan dari anon — proxy Vercel sudah
-- membacanya dari env AI_API_KEY.

-- =========================================================================
-- A. Tabel rahasia terkunci
--    RLS aktif tanpa satu pun policy: peran biasa tidak mendapat satu baris
--    pun. SECURITY DEFINER di bawah tetap bisa membaca karena jalan sebagai
--    owner (RLS tidak memaksa owner kecuali FORCE diaktifkan — jangan
--    aktifkan FORCE).
-- =========================================================================
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
-- Dua pernyataan terpisah: Postgres mengabaikan peran lain yang disebut
-- bersama PUBLIC (keluar warning "ignoring specified roles other than
-- PUBLIC"), jadi menyatukannya berarti hanya PUBLIC yang dicabut.
revoke all on table public.app_secrets from public;
revoke all on table public.app_secrets from anon, authenticated;

-- =========================================================================
-- B. update_latest_apk: secret dari tabel, URL divalidasi
--    Eksekusi dicabut dari authenticated supaya user login tidak bisa
--    memanggilnya; anon tetap boleh karena itu yang dipakai webhook.
-- =========================================================================
create or replace function public.update_latest_apk(p_url text, p_secret text)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare expected text;
begin
  select s.value into expected
  from public.app_secrets s
  where s.key = 'apk_promotion_secret';

  if expected is null or p_secret is null or length(p_secret) < 16 or p_secret <> expected then
    raise exception 'Unauthorized';
  end if;

  -- Kunci hanya mengizinkan artefak resmi Expo. Sekaligus mencegah pemegang
  -- secret mengarahkan pengunduh ke host lain.
  if p_url is null or p_url !~ '^https://expo\.dev/artifacts/eas/[A-Za-z0-9_-]+\.apk$' then
    raise exception 'Invalid APK URL';
  end if;

  insert into public.app_configs (key, value, description, updated_at)
  values ('latest_apk_url', p_url, 'URL unduhan APK Android versi terbaru', now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now();

  return true;
end;
$function$;

revoke execute on function public.update_latest_apk(text,text) from public;
revoke execute on function public.update_latest_apk(text,text) from authenticated;
grant  execute on function public.update_latest_apk(text,text) to anon;

-- =========================================================================
-- C. Kunci app_configs
--    Semua policy lama dibuang tanpa menebak namanya, lalu satu policy
--    SELECT baru yang menyisihkan ai_api_key. Tulis dicabut lewat GRANT,
--    supaya tidak bergantung pada nama policy.
--    SELECT tetap terbuka: lib/remoteConfig.ts, app/download.tsx dan
--    lib/downloadApp.ts membaca latest_apk_url langsung dari klien.
-- =========================================================================
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'app_configs'
  loop
    execute format('drop policy %I on public.app_configs', pol.policyname);
  end loop;
end $$;

-- Tidak menyebut daftar peran: begitu PUBLIC ikut, Postgres mengabaikan
-- peran lain (warning "ignoring specified roles other than PUBLIC").
-- Tanpa klausa TO, policy berlaku untuk semua peran — memang yang dikehendaki,
-- karena lib/remoteConfig.ts, app/download.tsx dan lib/downloadApp.ts
-- membaca latest_apk_url dari klien.
create policy app_configs_select_open on public.app_configs
  for select
  using (key <> 'ai_api_key');

revoke insert, update, delete on table public.app_configs from anon, authenticated;

-- =========================================================================
-- Langkah 2 — secret diisi TERPISAH, bukan lewat migration.
-- Sudah diisi di produksi; jangan di-commit karena Supabase menjalankan
-- migrasi ini lagi saat `supabase db push`, dan `on conflict do update`
-- di sini akan menimpa secret hidup dengan placeholder.
-- =========================================================================
-- insert into public.app_secrets (key, value, updated_at)
-- values ('apk_promotion_secret', '<isi-sendiri-lewat-dashboard-or-mcp>', now())
-- on conflict (key) do update set value = excluded.value, updated_at = now();

-- =========================================================================
-- Verifikasi — dijalankan sebagai anon untuk memastikan yang benar-benar
-- terbuka memang hanya yang diharapkan.
-- =========================================================================
-- set local role anon;
-- set local request.jwt.claims to '{"role":"anon"}';
-- select key from public.app_configs order by key;                                  -- ai_api_key tidak muncul
-- update public.app_configs set value = value where key = 'latest_apk_url';        -- gagal (42501)
-- select * from public.app_secrets;                                                 -- 0 baris
-- reset role;
-- select has_table_privilege('anon','public.app_configs','UPDATE');                 -- f
-- select policyname, cmd from pg_policies where tablename in ('app_configs','app_secrets');
-- select proname, prosecdef from pg_proc where proname = 'update_latest_apk';       -- t
