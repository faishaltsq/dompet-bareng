/**
 * lib/updates.ts
 * Guard OTA updates — aman di Expo Go, dev mode, dan web.
 * expo-updates hanya aktif di standalone APK/IPA yang dibangun dengan EAS.
 */

import { Platform } from 'react-native';

// Lazy-require karena expo-updates crash di web & Expo Go SDK 53+
let Updates: typeof import('expo-updates') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

export interface OTAResult {
  status: 'updated' | 'no_update' | 'not_supported' | 'error';
  message: string;
}

/**
 * Cek & terapkan OTA update.
 * Jika ada update baru, unduh lalu muat ulang app otomatis.
 * Jika tidak ada, kembalikan status 'no_update'.
 */
export async function checkAndApplyUpdate(): Promise<OTAResult> {
  // Guard 1: web tidak support OTA
  if (Platform.OS === 'web') {
    return { status: 'not_supported', message: 'OTA update tidak tersedia di web.' };
  }

  // Guard 2: dev mode → tidak ada bundle channel
  if (__DEV__) {
    return { status: 'not_supported', message: 'OTA update tidak aktif di mode development.' };
  }

  // Guard 3: modul tidak tersedia (Expo Go)
  if (!Updates) {
    return { status: 'not_supported', message: 'OTA update tidak tersedia di Expo Go.' };
  }

  // Guard 4: expo-updates tidak diaktifkan di build ini
  if (!Updates.isEnabled) {
    return {
      status: 'not_supported',
      message: 'OTA update tidak diaktifkan pada build ini.',
    };
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { status: 'no_update', message: 'Aplikasi sudah versi terbaru.' };
    }

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // App restart — baris setelah ini tidak dieksekusi
    return { status: 'updated', message: 'Update berhasil diterapkan!' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Terjadi kesalahan saat memeriksa update.';
    // Tangani kasus channel belum pernah dipublish → pesan user-friendly
    const isNoBundle =
      msg.includes('Failed to check') ||
      msg.includes('Call rejected') ||
      msg.includes('No update') ||
      msg.includes('no update');
    return {
      status: isNoBundle ? 'no_update' : 'error',
      message: isNoBundle ? 'Belum ada update yang diterbitkan.' : msg,
    };
  }
}

/** Ambil metadata update saat ini (versi, channel, dsb.) */
export function getCurrentUpdateInfo(): {
  channel: string | null;
  updateId: string | null;
  runtimeVersion: string | null;
  isEmbedded: boolean;
} {
  if (!Updates || __DEV__ || Platform.OS === 'web') {
    return { channel: null, updateId: null, runtimeVersion: null, isEmbedded: true };
  }
  return {
    channel: Updates.channel ?? null,
    updateId: Updates.updateId ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    isEmbedded: Updates.isEmbeddedLaunch ?? true,
  };
}
