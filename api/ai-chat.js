// api/ai-chat.js
// Server-side proxy untuk AI API — menyembunyikan API key dari client bundle.
// Hanya menerima request dari domain sendiri (Vercel).

const ALLOWED_ORIGINS = [
  'https://dompet-bareng.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

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

  // API key dari Vercel env — tidak pernah ada di client bundle
  const apiKey = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.AI_MODEL || 'deepseek-chat';

  if (!apiKey) {
    return res.status(500).json({ error: 'AI_API_KEY not configured on server' });
  }

  try {
    const { messages, temperature = 0.3 } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'DompetBareng/1.0 (Vercel Proxy)',
      },
      body: JSON.stringify({ model, messages, temperature, stream: false }),
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
