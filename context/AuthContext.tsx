import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  avatarUrl: string | null;
  signInWithGoogle: () => Promise<void>;
  signInDevGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (newName: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  avatarUrl: null,
  signInWithGoogle: async () => {},
  signInDevGuest: async () => {},
  signOut: async () => {},
  updateDisplayName: async () => false,
  refreshProfile: async () => {},
});

function ensureHttps(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://')) {
    return trimmed.replace('http://', 'https://');
  }
  return trimmed;
}

export function extractAvatarUrl(user: User | null, profile: UserProfile | null): string | null {
  if (!user && !profile) return null;

  // 1. Profile avatar dari database
  if (profile?.avatar_url) return ensureHttps(profile.avatar_url);

  // 2. User metadata dari Google OAuth
  const meta = user?.user_metadata;
  const metaAvatar = meta?.avatar_url || meta?.picture || meta?.avatar;
  if (metaAvatar && typeof metaAvatar === 'string') return ensureHttps(metaAvatar);

  // 3. Identities data dari provider Google
  if (user?.identities && Array.isArray(user.identities)) {
    for (const id of user.identities) {
      const idData = id?.identity_data;
      const idAvatar = idData?.avatar_url || idData?.picture || idData?.avatar;
      if (idAvatar && typeof idAvatar === 'string') return ensureHttps(idAvatar);
    }
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string, currentUser?: User | null) => {
    const u = currentUser ?? user;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .eq('id', uid)
      .single();

    const avatarFromUser = extractAvatarUrl(u, null);

    if (data) {
      const prof = data as UserProfile;
      // Jika profile di database belum punya avatar_url tapi di user metadata Google ada, simpan ke database
      if (!prof.avatar_url && avatarFromUser) {
        prof.avatar_url = avatarFromUser;
        try {
          await supabase
            .from('profiles')
            .update({ avatar_url: avatarFromUser })
            .eq('id', uid);
        } catch (_) {}
      }
      setProfile(prof);
    } else if (avatarFromUser || u?.email) {
      const newProf: UserProfile = {
        id: uid,
        email: u?.email || null,
        display_name: u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || 'Pengguna',
        avatar_url: avatarFromUser,
      };
      setProfile(newProf);
      try {
        await supabase.from('profiles').upsert(newProf);
      } catch (_) {}
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user);
  };

  useEffect(() => {
    // Inisialisasi session dari cache lokal dulu (instant, tidak tunggu network)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // ← selesai loading segera, fetchProfile background
      if (session?.user) fetchProfile(session.user.id, session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id, session.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Gunakan Linking.createURL('/') untuk Expo Go (exp://192.168.x.x:8081/--)
      // atau dompetbareng:// di standalone
      const redirectUri = Linking.createURL('/');

      if (Platform.OS === 'web') {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User menutup browser — jangan stuck loading
        return;
      }

      if (result.type === 'success' && result.url) {
        // Parse baik hash fragment (#access_token=...) maupun query param (?code=...)
        const parsedUrl = new URL(result.url);
        const hashParams = new URLSearchParams(
          parsedUrl.hash ? parsedUrl.hash.substring(1) : ''
        );
        const searchParams = parsedUrl.searchParams;

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const code = searchParams.get('code');

        if (code) {
          // PKCE flow (Supabase v2 default)
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          // Implicit flow
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else {
          throw new Error('No auth tokens or code in callback URL');
        }
      }
    } catch (e) {
      console.error('OAuth error:', e);
      throw e;
    }
  };

  // ponytail: dev staging login via Supabase anonymous sign-in, switch to strictly Google OAuth when launching to store
  const signInDevGuest = async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Fallback email dengan format domain valid
        const randomId = Math.random().toString(36).substring(2, 9);
        const { error: signUpError } = await supabase.auth.signUp({
          email: `tester_${randomId}@gmail.com`,
          password: 'TesterPassword123!',
        });
        if (signUpError) throw signUpError;
      }
    } catch (e: any) {
      console.error('Dev sign-in error:', e?.message || e);
    }
  };

  const updateDisplayName = async (newName: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName })
      .eq('id', user.id);
    if (!error) {
      setProfile(prev => prev ? { ...prev, display_name: newName } : prev);
      return true;
    }
    return false;
  };

  const signOut = async () => {
    try {
      // 1. Reset in-memory state segera
      setUser(null);
      setProfile(null);
      setSession(null);

      // 2. Clear Supabase auth di storage
      await supabase.auth.signOut({ scope: 'local' });

      // 3. Khusus Web: bersihkan localStorage/sessionStorage agar tidak ada sesi sisa
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch (_) {}
      }

      // 4. Khusus Native/Umum: bersihkan AsyncStorage
      try {
        await AsyncStorage.clear();
      } catch (_) {}
    } catch (e) {
      console.error('SignOut error:', e);
    }
  };

  const avatarUrl = useMemo(() => extractAvatarUrl(user, profile), [user, profile]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      loading,
      avatarUrl,
      signInWithGoogle,
      signInDevGuest,
      signOut,
      updateDisplayName,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
