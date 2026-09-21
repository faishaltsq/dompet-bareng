/**
 * lib/downloadApp.ts
 * Helper untuk mengunduh APK Android Dompet Bareng dari web / browser.
 */

import { Platform, Linking } from 'react-native';
import { getRemoteConfigSync } from './remoteConfig';

export function triggerDownloadApk() {
  const fallbackUrl = 'https://dompet-bareng.vercel.app/download';
  const apkUrl = getRemoteConfigSync('latest_apk_url') || fallbackUrl;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Buka tautan di tab baru atau langsung picu unduhan
    const a = document.createElement('a');
    a.href = apkUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    Linking.openURL(apkUrl);
  }
}
