import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from '@/lib/splash';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { MascotOverlay } from '@/components/MascotOverlay';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && Platform.OS !== 'web') {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  // Handle deep link OAuth callback: extract session tokens from URL
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = async (url: string) => {
      try {
        const parsed = new URL(url);
        const hash = parsed.hash ? parsed.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const searchParams = parsed.searchParams;

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const code = searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (_) {}
    };

    // Cold start: app opened via deep link
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });

    // Warm: app already open, deep link arrives
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <NotificationProvider>
          <LanguageProvider>
            <RootLayoutNav />
          </LanguageProvider>
        </NotificationProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    // Debounce: saat signed-out event datang sebelum signed-in (switch akun),
    // tunggu 500ms sebelum redirect ke login agar tidak flash
    if (!session && !inAuthGroup) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 500);
      return () => clearTimeout(timer);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" options={{ title: 'Gabung Workspace', presentation: 'modal' }} />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      {session && <MascotOverlay />}
    </ThemeProvider>
  );
}
