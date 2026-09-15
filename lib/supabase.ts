import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://uqsgnkgszlnpdfikubpq.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_S6P-4ECIlDrSvI3Mj04mHQ_0P_oLKAB';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // Web: harus true agar Supabase parse #access_token/code dari callback URL
    // Native: false karena token di-handle manual via openAuthSessionAsync
    detectSessionInUrl: Platform.OS === 'web',
  },
});
