/**
 * lib/downloadApp.ts
 * Helper untuk mengunduh APK Android Dompet Bareng dari web / browser.
 */

import { Platform, Linking } from 'react-native';

// Selalu lewat /api/download: server me-redirect ke APK yang sedang dipromosikan,
// jadi cache remote-config lama tidak bisa menyebabkan unduhan versi usang.
const APK_URL = 'https://dompet-bareng.vercel.app/api/download';

export function triggerDownloadApk() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Buka tautan di tab baru atau langsung picu unduhan
    const a = document.createElement('a');
    a.href = APK_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    Linking.openURL(APK_URL);
  }
}
