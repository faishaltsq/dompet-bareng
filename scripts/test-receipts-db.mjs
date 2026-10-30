// Isolated PostgreSQL 17 runner for the private-receipt migration.
//
// Proves SQL/RLS behaviour only. Storage HTTP enforcement (signed URLs, bucket
// MIME/size rejection at the API layer) still needs an authorized live smoke
// test; a green run here is not that proof.
//
// Usage: node scripts/test-receipts-db.mjs

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const name = `dompet-receipts-${randomUUID().slice(0, 8)}`
const dir = path.join(root, 'supabase/tests/receipts')
const migrationDir = path.join(root, 'supabase/migrations')
const migration = '20261030000100_private_transaction_receipts.sql'
const db = 'receipts_test_local'

const docker = (args, input) =>
  execFileSync('docker', args, { input, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })

const sql = (text) =>
  docker(['exec', '-i', name, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-d', db,
    '-v', 'ON_ERROR_STOP=1', '-qAt'], text)

const run = (file) => {
  sql(readFileSync(file, 'utf8'))
  console.log(`PASS ${path.relative(root, file)}`)
}

if (!existsSync(path.join(migrationDir, migration))) {
  throw new Error(`Missing migration ${migration}`)
}

let started = false
try {
  docker(['run', '-d', '--name', name, '--network', 'none',
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', `POSTGRES_DB=${db}`,
    'postgres:17-alpine'])
  started = true

  const deadline = Date.now() + 60000
  for (;;) {
    try {
      docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', db])
      break
    } catch {
      if (Date.now() > deadline) throw new Error('Postgres readiness deadline exceeded')
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  run(path.join(dir, 'baseline.sql'))
  run(path.join(dir, 'assertions.sql'))
  run(path.join(dir, 'fixtures.sql'))

  // Positive control must pass on the un-migrated baseline.
  run(path.join(dir, 'pre_migration_control.sql'))
  console.log('PASS pre-migration control: anonymous legacy upload was allowed')

  const migrationPath = path.join(migrationDir, migration)
  run(migrationPath)
  console.log('PASS migration first apply')

  run(path.join(dir, 'authorization.sql'))
  console.log('PASS authorization and denial proofs')

  // Replay safety: a second apply must succeed and change nothing observable.
  run(migrationPath)
  console.log('PASS migration replay')

  const after = sql(`
    select (select count(*) from storage.objects where bucket_id = 'workspace-images')
      || '|' || (select count(*) from storage.objects where bucket_id = 'transaction-receipts')
      || '|' || (select count(*) from public.transactions)
      || '|' || (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname in ('receipt_member_select','receipt_owner_insert','receipt_unreferenced_delete'))
      || '|' || (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Allow upload')
      || '|' || (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'workspace_images_authenticated_insert');
  `).trim()
  if (after !== '2|0|1|3|0|1') {
    throw new Error(`Post-replay inventory changed: ${after}`)
  }
  console.log('PASS legacy objects, rows and policy inventory unchanged after replay')

  const assertionCount = (readFileSync(path.join(dir, 'authorization.sql'), 'utf8').match(/test_assert|test_reject/g) || []).length
  console.log(`Receipt database proofs: PASS (${assertionCount} assertion calls, ${readdirSync(migrationDir).length} migrations on disk)`)
} finally {
  if (started) docker(['rm', '-f', name])
}
