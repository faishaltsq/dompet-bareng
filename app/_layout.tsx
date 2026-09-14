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
