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

function selectPromotableApk(build, policy) {
  if (!build || typeof build !== 'object' || Array.isArray(build) || policy?.hold !== false) return null
  if (typeof policy.approvedBuildId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(policy.approvedBuildId) || !apkUrl(policy.approvedBuildUrl)) return null
  if (!policy.expectedProjectId || !policy.expectedAppIdentifier || !policy.expectedVersion || !Number.isSafeInteger(policy.expectedVersionCode) || policy.expectedVersionCode < 1) return null
  const m = build.metadata ?? {}
  if (build.id !== policy.approvedBuildId || !matches('finished', [build.status], lower) || !matches('android', [build.platform], lower)) return null
  if (!matches(policy.expectedProjectId, [build.appId, build.app?.id, m.trackingContext?.project_id]) ||
      !matches(policy.expectedAppIdentifier, [build.appIdentifier, m.appIdentifier]) ||
      !matches(policy.expectedVersion, [build.appVersion, m.appVersion]) ||
      !matches(policy.expectedVersionCode, [build.appBuildVersion, m.appBuildVersion]) ||
      !matches(policy.expectedVersion, [build.runtime?.version, m.runtimeVersion, build.runtimeVersion]) ||
      !matches('preview', [build.buildProfile, m.buildProfile]) ||
      !matches('preview', [build.updateChannel?.name, build.channel, m.channel]) ||
      !matches('internal', [build.distribution, m.distribution], lower)) return null
  const urls = [build.artifacts?.buildUrl, build.artifacts?.applicationArchiveUrl].filter(value => value !== undefined && value !== null)
  if (!urls.length || !urls.every(value => apkUrl(value) && value === policy.approvedBuildUrl)) return null
  return { buildId: build.id, url: policy.approvedBuildUrl }
}

function promotionPolicy(expo, env = process.env) {
  return {
    hold: env.APK_PROMOTION_HOLD !== 'false',
    expectedProjectId: expo?.extra?.eas?.projectId,
    expectedAppIdentifier: expo?.android?.package,
    expectedVersion: expo?.version,
    expectedVersionCode: expo?.android?.versionCode,
    approvedBuildId: env.APK_PROMOTION_BUILD_ID || null,
    approvedBuildUrl: env.APK_PROMOTION_BUILD_URL || null,
  }
}
module.exports = { verifyEasSignature, selectPromotableApk, promotionPolicy }
