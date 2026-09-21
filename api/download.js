// api/download.js
// Redirects /download directly to the latest Android APK

module.exports = async (req, res) => {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uqsgnkgszlnpdfikubpq.supabase.co';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseAnonKey) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/app_configs?key=eq.latest_apk_url&select=value`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      });

      if (resp.ok) {
        const rows = await resp.json();
        const apkUrl = rows?.[0]?.value;
        if (apkUrl && apkUrl.startsWith('http')) {
          res.writeHead(307, { Location: apkUrl });
          return res.end();
        }
      }
    }

    // Fallback if Supabase not reachable
    res.writeHead(307, { Location: 'https://expo.dev/accounts/faishaltsq/projects/dompet-bareng/builds' });
    res.end();
  } catch (e) {
    res.writeHead(307, { Location: 'https://expo.dev/accounts/faishaltsq/projects/dompet-bareng/builds' });
    res.end();
  }
};
