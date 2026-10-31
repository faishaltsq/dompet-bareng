const crypto = require('node:crypto')

function verifyEasSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== 'string' || secret.length < 16 || typeof signature !== 'string' || !/^sha1=[0-9a-f]{40}$/.test(signature)) return false
  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest()
  const received = Buffer.from(signature.slice(5), 'hex')
  return received.length === expected.length && crypto.timingSafeEqual(received, expected)
}

function matches(expected, values, normalize = String) {
  const present = values.filter(value => value !== undefined && value !== null)
  return present.length > 0 && present.every(value => (typeof value === 'string' || typeof value === 'number') && normalize(value) === normalize(expected))
}
const lower = value => String(value).toLowerCase()
const apkUrl = value => typeof value === 'string' && /^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/.test(value)

// Auto-promotes every finished preview APK that matches the app identity in app.json.
// No per-release build whitelist: the site always serves the newest approved build.
function selectPromotableApk(build, policy) {
  if (!build || typeof build !== 'object' || Array.isArray(build) || policy?.hold !== false) return null
  if (!policy.expectedProjectId || !policy.expectedAppIdentifier || !policy.expectedVersion || !Number.isSafeInteger(policy.expectedVersionCode) || policy.expectedVersionCode < 1) return null
  if (typeof build.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(build.id)) return null
  const m = build.metadata ?? {}
  if (!matches('finished', [build.status], lower) || !matches('android', [build.platform], lower)) return null
  if (!matches(policy.expectedProjectId, [build.appId, build.app?.id, m.trackingContext?.project_id]) ||
      !matches(policy.expectedAppIdentifier, [build.appIdentifier, m.appIdentifier]) ||
      !matches(policy.expectedVersion, [build.appVersion, m.appVersion]) ||
      !matches(policy.expectedVersionCode, [build.appBuildVersion, m.appBuildVersion]) ||
      !matches(policy.expectedVersion, [build.runtime?.version, m.runtimeVersion, build.runtimeVersion]) ||
      !matches('preview', [build.buildProfile, m.buildProfile]) ||
      !matches('preview', [build.updateChannel?.name, build.channel, m.channel]) ||
      !matches('internal', [build.distribution, m.distribution], lower)) return null
  const urls = [build.artifacts?.buildUrl, build.artifacts?.applicationArchiveUrl].filter(value => value !== undefined && value !== null)
  if (!urls.length || !urls.every(value => apkUrl(value) && value === urls[0])) return null
  return { buildId: build.id, url: urls[0] }
}

function promotionPolicy(expo, env = process.env) {
  return {
    hold: env.APK_PROMOTION_HOLD === 'true',
    expectedProjectId: expo?.extra?.eas?.projectId,
    expectedAppIdentifier: expo?.android?.package,
    expectedVersion: expo?.version,
    expectedVersionCode: expo?.android?.versionCode,
  }
}
module.exports = { verifyEasSignature, selectPromotableApk, promotionPolicy }
