import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from '@/lib/splash';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { MascotOverlay } from '@/components/MascotOverlay';
import OfflineBanner from '@/components/OfflineBanner';
import { readPendingInvite, clearPendingInvite } from '@/lib/pendingInvite';
import { useInviteNavigation } from '@/hooks/useInviteNavigation';
import { onDailyReminderReceived, refreshDailyReminderSchedule } from '@/lib/notifications';
import { initRemoteConfig } from '@/lib/remoteConfig';
import { useWidgetSync } from '@/hooks/useWidgetSync';

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

  // Inisialisasi Remote Config (AI Base URL, model, dsb.)
  useEffect(() => {
    initRemoteConfig().catch(() => {});
  }, []);


  // Listen untuk notifikasi harian yang diterima (foreground) → rotasi pesan untuk hari berikutnya
  // + top-up jadwal setiap kali app dibuka
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Top-up jadwal notifikasi saat app startup
    refreshDailyReminderSchedule().catch(() => {});

    let notifSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      notifSub = Notifications.addNotificationReceivedListener((notification: any) => {
        const data = notification?.request?.content?.data;
        if (data?.type === 'daily_reminder') {
          onDailyReminderReceived().catch(() => {});
        }
      });
    } catch {}

    return () => {
      notifSub?.remove();
    };
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
  const { session, user, loading } = useAuth();
  const navigation = useRootNavigationState();
  const ready = Boolean(navigation?.key);
  const registered = Boolean(user && !user.is_anonymous && (user.email || user.app_metadata?.provider === 'google'));
  const segments = useSegments();
  const router = useRouter();
  const { t } = useLanguage();
  useWidgetSync();
  useInviteNavigation(ready);

  useEffect(() => {
    if (loading || !ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    const isPublicRoute =
      segments[0] === 'privacy' ||
      segments[0] === 'terms' ||
      segments[0] === 'invite' ||
      segments[0] === 'download';

    // Debounce: saat signed-out event datang sebelum signed-in (switch akun),
    // tunggu 500ms sebelum redirect ke login agar tidak flash
    if (!session && !inAuthGroup && !isPublicRoute) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 500);
      return () => clearTimeout(timer);
    } else if (session) {
      let alive = true;
      void (async () => {
        const pending = registered && segments[0] !== 'invite' ? await readPendingInvite() : null;
        if (!alive) return;
        if (pending) {
          router.replace({ pathname: '/invite/[token]', params: { token: pending.token } });
          // The navigation intent is fulfilled, not a request to auto-submit.
          await clearPendingInvite();
        } else if (inAuthGroup) router.replace('/(tabs)');
      })();
      return () => { alive = false; };
    }
  }, [session, loading, ready, registered, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OfflineBanner />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="invite/[token]" options={{ title: t('screenTitleJoinWorkspace'), presentation: 'modal' }} />
        <Stack.Screen name="join-requests" options={{ title: t('myJoinRequests') }} />
        <Stack.Screen name="scan-invite" options={{ title: t('scanInviteTitle') }} />
        <Stack.Screen name="transaction/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ title: 'Kebijakan Privasi' }} />
        <Stack.Screen name="terms" options={{ title: 'Ketentuan Layanan' }} />
        <Stack.Screen name="download" options={{ title: t('downloadAndroidApp'), headerShown: false }} />
      </Stack>
      {session && <MascotOverlay />}
    </ThemeProvider>
  );
}
