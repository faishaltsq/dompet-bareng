// api/eas-webhook.js
// Handles EAS Build webhook events to automatically update latest_apk_url in Supabase

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    console.log('[EAS Webhook] Received build event:', {
      status: payload?.status,
      platform: payload?.platform,
      id: payload?.id,
    });

    const status = String(payload?.status || '').toLowerCase();
    const platform = String(payload?.platform || '').toLowerCase();
    const buildUrl = payload?.artifacts?.buildUrl || payload?.artifacts?.applicationArchiveUrl;

    if (status === 'finished' && platform === 'android' && buildUrl) {
      console.log('[EAS Webhook] New Android APK Build finished! URL:', buildUrl);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uqsgnkgszlnpdfikubpq.supabase.co';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseAnonKey) {
        console.error('[EAS Webhook] Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
        return res.status(500).json({ error: 'Missing Supabase credentials' });
      }

      const secret = process.env.WEBHOOK_APK_SECRET || process.env.EAS_WEBHOOK_SECRET || 'db_apk_secret_98827361';

      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/update_latest_apk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          p_url: buildUrl,
          p_secret: secret,
        }),
      });

      if (!rpcRes.ok) {
        const errorText = await rpcRes.text();
        console.error('[EAS Webhook] Supabase update failed:', errorText);
        return res.status(500).json({ error: 'Failed to update remote config', detail: errorText });
      }

      console.log('[EAS Webhook] Successfully updated latest_apk_url in Supabase!');
      return res.status(200).json({ success: true, updated: true, buildUrl });
    }

    return res.status(200).json({ success: true, ignored: true, reason: 'Not a finished android build' });
  } catch (err) {
    console.error('[EAS Webhook] Exception:', err);
    return res.status(500).json({ error: err.message });
  }
};
