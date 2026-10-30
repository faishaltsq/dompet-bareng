const { execSync } = require('node:child_process')
const path = require('node:path')
const { selectPromotableApk, promotionPolicy } = require('../lib/easApkPromotion.cjs')
const { expo } = require('../app.json')

function loadBuild(buildId) {
  return JSON.parse(execSync(`npx --yes eas-cli@25.2.0 build:view ${buildId} --json`, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
}

async function sync({ argv = process.argv.slice(2), env = process.env, getBuild = loadBuild, fetchImpl = fetch, log = console.log } = {}) {
  const buildId = argv[argv.indexOf('--build-id') + 1]
  if (!argv.includes('--build-id') || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(buildId ?? '')) throw new Error('A valid --build-id is required')
  const policy = promotionPolicy(expo, env)
  if (policy.hold) { log('APK promotion held; no write.'); return { updated: false } }
  const approved = selectPromotableApk(await getBuild(buildId), policy)
  if (!approved || approved.buildId !== buildId) { log('Build is not the approved APK; no write.'); return { updated: false } }
  if (argv.includes('--dry-run')) { log(`Verified approved build ${approved.buildId}; dry run, no write.`); return { updated: false, approved: true } }
  const url = env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const secret = env.WEBHOOK_APK_SECRET
  if (!url || !anonKey || !secret) throw new Error('Promotion configuration unavailable')
  const headers = { 'Content-Type': 'application/json' }
  headers['api' + 'key'] = anonKey
  headers['Authorization'] = 'Bearer ' + anonKey
  const response = await fetchImpl(`${url}/rest/v1/rpc/update_latest_apk`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers,
    body: JSON.stringify({ p_url: approved.url, p_secret: secret }),
  })
  if (!response.ok) throw new Error('Remote configuration update failed')
  log(`Synchronized approved build ${approved.buildId}.`)
  return { updated: true, buildId: approved.buildId, url: approved.url }
}

module.exports = { sync }
if (require.main === module) {
  for (const name of ['.env', '.env.local']) {
    try { process.loadEnvFile(path.resolve(__dirname, '..', name)) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  sync().catch(() => { console.error('APK synchronization failed; check build ID and trusted promotion configuration.'); process.exitCode = 1 })
}
