/**
 * lib/remoteConfig.ts
 * Remote Configuration via Supabase table `app_configs`.
 * Memungkinkan update konfigurasi (URL tunnel AI, model, dll.) secara dinamis
 * tanpa perlu rebuild APK atau rilis OTA baru.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const CACHE_CONFIG_KEY = '@db:remote_app_configs';

// In-memory cache
let inMemoryConfigs: Record<string, string> = {};
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Listeners for real-time changes
type ConfigListener = (configs: Record<string, string>) => void;
const listeners = new Set<ConfigListener>();

/**
 * Inisialisasi: baca dari AsyncStorage dulu (instant),
 * lalu fetch data terbaru dari Supabase dan setup realtime listener.
 */
export async function initRemoteConfig(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Baca cache lokal
      const cached = await AsyncStorage.getItem(CACHE_CONFIG_KEY);
      if (cached) {
        try {
          inMemoryConfigs = { ...JSON.parse(cached), ...inMemoryConfigs };
        } catch {}
      }

      // 2. Fetch dari Supabase
      await refreshRemoteConfig();

      // 3. Pasang Realtime Subscription untuk update instan
      supabase
        .channel('app_configs_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_configs' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new as { key: string; value: string };
              if (row && row.key) {
                inMemoryConfigs[row.key] = row.value;
                AsyncStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(inMemoryConfigs)).catch(() => {});
                listeners.forEach(cb => cb({ ...inMemoryConfigs }));
              }
            } else if (payload.eventType === 'DELETE') {
              const row = payload.old as { key: string };
              if (row && row.key) {
                delete inMemoryConfigs[row.key];
                AsyncStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(inMemoryConfigs)).catch(() => {});
                listeners.forEach(cb => cb({ ...inMemoryConfigs }));
              }
            }
          }
        )
        .subscribe();

      isInitialized = true;
    } catch (e) {
      console.warn('initRemoteConfig failed:', e);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Refresh manual dari database Supabase
 */
export async function refreshRemoteConfig(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('app_configs')
      .select('key, value');

    if (!error && data) {
      const fresh: Record<string, string> = {};
      data.forEach((item: { key: string; value: string }) => {
        fresh[item.key] = item.value;
      });
      inMemoryConfigs = { ...inMemoryConfigs, ...fresh };
      await AsyncStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(inMemoryConfigs));
      listeners.forEach(cb => cb({ ...inMemoryConfigs }));
    }
  } catch (e) {
    console.warn('refreshRemoteConfig error:', e);
  }
  return inMemoryConfigs;
}

/**
 * Ambil satu nilai config berdasarkan key.
 * Mengembalikan in-memory / cache jika tersedia, atau defaultValue.
 */
export function getRemoteConfigSync(key: string, defaultValue = ''): string {
  return inMemoryConfigs[key] ?? defaultValue;
}

/**
 * Ambil nilai config secara async (memastikan init sudah selesai).
 */
export async function getRemoteConfig(key: string, defaultValue = ''): Promise<string> {
  if (!isInitialized) {
    await initRemoteConfig();
  }
  return inMemoryConfigs[key] ?? defaultValue;
}

/**
 * Subscribe perubahan remote config secara realtime.
 */
export function subscribeRemoteConfig(listener: ConfigListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
