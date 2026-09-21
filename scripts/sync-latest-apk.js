// scripts/sync-latest-apk.js
// Ambil URL build APK Android terbaru dari EAS CLI dan sinkronkan ke Supabase app_configs

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Auto-load .env and .env.local if present
['../.env', '../.env.local'].forEach(rel => {
  try {
    const envPath = path.resolve(__dirname, rel);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  } catch (_) {}
});

async function sync() {
  console.log('📦 Memeriksa build Android terbaru dari Expo EAS...');
  try {
    const raw = execSync('npx eas-cli build:list --platform android --limit 1 --json', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const builds = JSON.parse(raw);
    const latest = builds?.[0];

    if (!latest) {
      console.error('❌ Tidak ada build Android yang ditemukan di EAS.');
      process.exit(1);
    }

    const buildUrl = latest.artifacts?.buildUrl || latest.artifacts?.applicationArchiveUrl;
    const status = latest.status;
    const buildId = latest.id;

    console.log(`📌 Build ID: ${buildId}`);
    console.log(`📌 Status  : ${status}`);
    console.log(`📌 APK URL : ${buildUrl}`);

    if (status !== 'FINISHED' || !buildUrl) {
      console.warn('⚠️ Build terakhir belum selesai atau tidak memiliki artifact APK.');
      process.exit(0);
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uqsgnkgszlnpdfikubpq.supabase.co';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseAnonKey) {
      console.error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY tidak ditemukan di environment.');
      process.exit(1);
    }

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/update_latest_apk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        p_url: buildUrl,
        p_secret: 'db_apk_secret_98827361',
      }),
    });

    if (!rpcRes.ok) {
      const err = await rpcRes.text();
      console.error('❌ Gagal memperbarui Supabase:', err);
      process.exit(1);
    }

    console.log('✅ Berhasil menyinkronkan URL APK terbaru ke Supabase app_configs!');
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

sync();
