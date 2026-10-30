const { verifyEasSignature, selectPromotableApk, promotionPolicy } = require('../lib/easApkPromotion.cjs')
const { expo } = require('../app.json')

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    if (req.rawBody.length > 1024 * 1024) throw new Error('body_too_large')
    return req.rawBody
  }
  if (typeof req[Symbol.asyncIterator] !== 'function' || req.readableEnded) throw new Error('raw_body_unavailable')
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1024 * 1024) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

module.exports = async function easWebhook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const signingSecret = process.env.EAS_WEBHOOK_SIGNING_SECRET
  if (!signingSecret || signingSecret.length < 16) return res.status(503).json({ error: 'Webhook configuration unavailable' })
  let raw
  try { raw = await readRawBody(req) }
  catch (error) { return res.status(error.message === 'body_too_large' ? 413 : 400).json({ error: 'Original request body unavailable' }) }
  if (!verifyEasSignature(raw, req.headers['expo-signature'], signingSecret)) return res.status(401).json({ error: 'Invalid signature' })
  let payload
  try { payload = JSON.parse(raw.toString('utf8')) }
  catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  const approved = selectPromotableApk(payload, promotionPolicy(expo))
  if (!approved) return res.status(200).json({ success: true, ignored: true, reason: 'Held or not the approved APK' })
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  const rpcSecret = process.env.WEBHOOK_APK_SECRET
  if (!supabaseUrl || !anonKey || !rpcSecret) return res.status(503).json({ error: 'Promotion configuration unavailable' })
  try {
    const headers = { 'Content-Type': 'application/json' };
    headers['api' + 'key'] = anonKey;
    headers['Authorization'] = 'Bearer ' + anonKey;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/update_latest_apk`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers,
      body: JSON.stringify({ p_url: approved.url, p_secret: rpcSecret }),
    })
    if (!response.ok) return res.status(502).json({ error: 'Remote configuration update failed' })
    return res.status(200).json({ success: true, updated: true, buildId: approved.buildId })
  } catch { return res.status(502).json({ error: 'Remote configuration update unavailable' }) }
}
module.exports.config = { api: { bodyParser: false } }