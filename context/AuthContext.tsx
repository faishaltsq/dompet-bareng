import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
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

function ensureHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://')) {
    return trimmed.replace('http://', 'https://');
  }
  return trimmed;
}

function isValidAvatarUrl(url: any): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length < 8) return false;
  if (trimmed === 'null' || trimmed === 'undefined') return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/');
}

export function extractAvatarUrl(user: User | null, profile: UserProfile | null): string | null {
  if (!user && !profile) return null;

  // 1. Cek Google user metadata (prioritas: foto asli akun Google)
  const meta = user?.user_metadata;
  const rawMeta = (user as any)?.raw_user_meta_data;

  const candidateMeta = [
    meta?.avatar_url,
    meta?.picture,
    meta?.avatar,
    meta?.photo_url,
    meta?.photoURL,
    meta?.image,
    meta?.image_url,
    rawMeta?.avatar_url,
    rawMeta?.picture,
    rawMeta?.photo_url,
  ];

  for (const c of candidateMeta) {
    if (isValidAvatarUrl(c)) return ensureHttps(c);
  }

  // 2. Cek identities data dari Google provider
  if (user?.identities && Array.isArray(user.identities)) {
    for (const id of user.identities) {
      const idData = id?.identity_data;
      const candidateId = [
        idData?.avatar_url,
        idData?.picture,
        idData?.avatar,
        idData?.photo_url,
        idData?.photoURL,
        idData?.image,
        idData?.image_url,
      ];
      for (const c of candidateId) {
        if (isValidAvatarUrl(c)) return ensureHttps(c);
      }
    }
  }

  // 3. Cek profile avatar dari database Supabase
  if (isValidAvatarUrl(profile?.avatar_url)) {
    return ensureHttps(profile.avatar_url);
  }

  // 4. Default / Fallback bawaan Google:
  // Jika user login Google (provider Google atau email akun asli), tetapi akun Google-nya
  // tidak memiliki foto kustom yang di-upload, buatkan avatar bawaan Google yang authentic!
  const isGoogleUser = Boolean(
    user?.app_metadata?.provider === 'google' ||
    user?.identities?.some(i => i.provider === 'google') ||
    (user?.email && !user.email.includes('tester_') && !user.is_anonymous)
  );

  if (isGoogleUser) {
    const name = profile?.display_name || meta?.full_name || meta?.name || user?.email?.split('@')[0] || 'User';
    // Google Official Avatar: background Google Blue (#4285F4) dengan inisial putih tebal
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=FFFFFF&size=128&bold=true`;
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
      // Jika profile di database belum punya avatar_url atau avatarFromUser ada dan beda, simpan ke database
      if (avatarFromUser && (!prof.avatar_url || prof.avatar_url !== avatarFromUser)) {
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
    // 1. Inisialisasi session dari cache lokal dulu (instant UI)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
        // 2. Fetch data user terbaru langsung dari server (dapatkan metadata & identities Google terlengkap)
        supabase.auth.getUser().then(({ data: { user: latestUser } }) => {
          if (latestUser) {
            setUser(latestUser);
            fetchProfile(latestUser.id, latestUser);
          }
        }).catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          supabase.auth.getUser().then(({ data: { user: latestUser } }) => {
            if (latestUser) {
              setUser(latestUser);
              fetchProfile(latestUser.id, latestUser);
            }
          }).catch(() => {});
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Gunakan scheme native explicitly: dompetbareng://
      const redirectUri = makeRedirectUri({
        scheme: 'dompetbareng',
        path: '',
      });

      if (Platform.OS === 'web') {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
            scopes: 'email profile openid',
          },
        });
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          scopes: 'email profile openid',
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

      // Tutup browser tab agar kembali ke app native
      WebBrowser.dismissBrowser();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type === 'success' && result.url) {
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
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (exchangeData?.user) {
            setUser(exchangeData.user);
            await fetchProfile(exchangeData.user.id, exchangeData.user);
          }
        } else if (accessToken && refreshToken) {
          // Implicit flow
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          if (sessionData?.user) {
            setUser(sessionData.user);
            await fetchProfile(sessionData.user.id, sessionData.user);
          }
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
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
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

      // 3. Khusus Web: bersihkan localStorage/sessionStorage Supabase & app keys saja
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && (k.startsWith('@dompetbareng') || k.startsWith('sb-'))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach(k => window.localStorage.removeItem(k));
          window.sessionStorage.clear();
        } catch (_) {}
      }

      // 4. Khusus Native/Umum: bersihkan cache data user tanpa menghapus preferensi perangkat (bahasa/notif)
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter(
          k => !k.startsWith('@dompetbareng_app_language') && !k.startsWith('@db:daily_reminder')
        );
        await AsyncStorage.multiRemove(userKeys);
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
