// api/ai-chat.js
// Server-side proxy untuk AI API — API key hanya ada di Vercel env, tidak pernah
// di client bundle ataupun di tabel Supabase yang bisa dibaca anon.
//
// Dua kontrol:
//   1. Autentikasi: setiap request wajib membawa Supabase access token yang valid.
//      Tanpa ini proxy menjadi relay terbuka yang bisa dipakai siapa pun untuk
//      membakar API key lewat curl.
//   2. CORS: hanya origin sendiri yang dibalas header-nya (defense in depth —
//      CORS bukan kontrol akses; nomor 1 di atas yang benar-benar menolak).

const ALLOWED_ORIGINS = [
  'https://dompet-bareng.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

const MAX_MESSAGES = 60;
const MAX_MESSAGE_CHARS = 8000;

// Remote config ai_base_url / ai_model dibaca dari app_configs di server, di-cache
// 60 detik, supaya URL/model bisa diganti tanpa redeploy (paritas dengan perilaku lama).
let cfgCache = { at: 0, base: '', model: '' };

async function aiConfig() {
  const now = Date.now();
  if (cfgCache.at && now - cfgCache.at < 60000 && cfgCache.base) return cfgCache;

  let base = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  let model = process.env.AI_MODEL || 'deepseek-chat';

  try {
    const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (supaUrl && anon) {
      const r = await fetch(
        `${supaUrl}/rest/v1/app_configs?select=key,value&key=in.(ai_base_url,ai_model)`,
        { headers: { apikey: anon, authorization: `Bearer ${anon}` } }
      );
      if (r.ok) {
        for (const row of await r.json()) {
          if (row.key === 'ai_base_url' && row.value) base = row.value;
          if (row.key === 'ai_model' && row.value) model = row.value;
        }
      }
    }
  } catch (e) {
    // Remote config tidak terjangkau: pakai fallback env, request tetap jalan.
  }

  cfgCache = { at: now, base, model };
  return cfgCache;
}

// Validasi token Supabase. Mengembalikan user bila sah, null bila tidak.
async function authenticate(req) {
  const raw = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = String(raw).replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supaUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anon) return null; // fail closed

  try {
    const r = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anon, authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null; // fail closed bila Supabase tidak terjangkau
  }
}

module.exports = async (req, res) => {
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticate(req);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const apiKey = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({ error: 'AI_API_KEY not configured on server' });
  }

  try {
    const { messages, temperature = 0.3, max_tokens } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `messages limited to ${MAX_MESSAGES}` });
    }
    if (messages.some(m => !m || typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS)) {
      return res.status(400).json({ error: 'invalid message content' });
    }

    const { base, model } = await aiConfig();

    // Format Google Generative Language — dipakai bila ai_base_url diganti ke endpoint Google.
    if (base.includes('generativelanguage.googleapis.com')) {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const upstream = await fetch(`${base}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature, maxOutputTokens: max_tokens },
        }),
      });
      if (!upstream.ok) {
        const err = await upstream.text();
        return res.status(upstream.status).json({ error: err.slice(0, 300) });
      }
      const data = await upstream.json();
      return res.status(200).json({ content: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '' });
    }

    // Default: OpenAI-compatible (DeepSeek / 9Router / tunnel).
    const endpoint = `${base.replace(/\/+$/, '')}/chat/completions`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DompetBareng/1.0 (Vercel Proxy)',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
        ...(Number.isFinite(max_tokens) ? { max_tokens } : {}),
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(upstream.status).json({ error: err.slice(0, 300) });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ content });
  } catch (e) {
    console.error('[ai-chat proxy] error:', e);
    return res.status(500).json({ error: 'Upstream AI request failed' });
  }
};
