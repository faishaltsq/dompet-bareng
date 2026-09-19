import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Global offline banner — shows a non-intrusive top bar when device loses connectivity.
 * Uses navigator.onLine (web) or periodic fetch probe (native) to detect status.
 * ponytail: upgrade to @react-native-community/netinfo when adding offline queue.
 */
export default function OfflineBanner() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Web: use navigator.onLine events
    if (Platform.OS === 'web') {
      const update = () => setOnline(navigator.onLine);
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      update();
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Native: lightweight probe every 30s + on app foreground only
    let timer: ReturnType<typeof setInterval>;

    const probe = async () => {
      try {
        // Tiny HEAD request to a fast endpoint
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: ctrl.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };

    const startTimer = () => {
      clearInterval(timer);
      timer = setInterval(probe, 30_000);
    };

    probe();
    startTimer();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        probe();
        startTimer();
      } else {
        clearInterval(timer);
      }
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  if (online) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>{t('offlineBanner')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
