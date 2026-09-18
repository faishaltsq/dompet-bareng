import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ponytail: in-memory fallback jika AsyncStorage null (Expo Go edge case)
const storage = {
  getItem: async (key: string) => {
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string) => {
    try { await AsyncStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key: string) => {
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

/** Fetch wrapper dengan AbortController timeout 10 detik untuk semua Supabase call */
function fetchWithTimeout(url: RequestInfo, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout as any,
  },
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // Web: harus true agar Supabase parse #access_token/code dari callback URL
    // Native: false karena token di-handle manual via openAuthSessionAsync
    detectSessionInUrl: Platform.OS === 'web',
  },
});
