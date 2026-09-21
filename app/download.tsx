import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Shadows, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { getRemoteConfigSync, initRemoteConfig } from '@/lib/remoteConfig';
import { triggerDownloadApk } from '@/lib/downloadApp';

const MASCOT_IMG = require('@/assets/images/app-mascot-wallet.png');

export default function DownloadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [apkUrl, setApkUrl] = useState<string>('');

  useEffect(() => {
    initRemoteConfig().then(() => {
      const url = getRemoteConfigSync('latest_apk_url');
      if (url) setApkUrl(url);
    });
  }, []);

  const handleDownload = () => {
    triggerDownloadApk();
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: t('downloadAndroidApp'), headerShown: Platform.OS !== 'web' }} />
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Mascot Hero */}
        <View style={s.mascotContainer}>
          <Image source={MASCOT_IMG} style={s.mascotImg} resizeMode="contain" />
        </View>

        <Text style={s.title}>{t('downloadAppTitle')}</Text>
        <Text style={s.subtitle}>{t('downloadAppSubtitle')}</Text>

        {/* Big Download Button */}
        <TouchableOpacity style={s.downloadBtn} onPress={handleDownload} activeOpacity={0.85}>
          <Ionicons name="logo-android" size={26} color="#FFFFFF" style={{ marginRight: 10 }} />
          <View>
            <Text style={s.downloadBtnTitle}>{t('downloadApkBtn')}</Text>
            <Text style={s.downloadBtnSub}>Format .APK • Gratis</Text>
          </View>
        </TouchableOpacity>

        {/* Feature Cards */}
        <View style={s.featureGrid}>
          <View style={s.featureCard}>
            <Ionicons name="flash-outline" size={20} color={Colors.income} />
            <Text style={s.featureTitle}>Lebih Cepat</Text>
            <Text style={s.featureDesc}>Animasi mulus 60fps & loading instan</Text>
          </View>
          <View style={s.featureCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            <Text style={s.featureTitle}>Login Native</Text>
            <Text style={s.featureDesc}>One-tap Google Sign-In tanpa browser</Text>
          </View>
        </View>

        {/* Instructions Card */}
        <View style={s.instructionCard}>
          <Text style={s.instructionHeader}>Cara Pasang APK di HP Android:</Text>
          <View style={s.stepRow}>
            <Text style={s.stepNum}>1</Text>
            <Text style={s.stepText}>Klik tombol <Text style={{ fontWeight: '700' }}>Unduh APK</Text> di atas.</Text>
          </View>
          <View style={s.stepRow}>
            <Text style={s.stepNum}>2</Text>
            <Text style={s.stepText}>Buka file unduhan dari notifikasi atau folder <Text style={{ fontWeight: '700' }}>Download</Text>.</Text>
          </View>
          <View style={s.stepRow}>
            <Text style={s.stepNum}>3</Text>
            <Text style={s.stepText}>Jika muncul peringatan keamanan, pilih <Text style={{ fontWeight: '700' }}>Tetap Download / Izinkan</Text>.</Text>
          </View>
          <View style={s.stepRow}>
            <Text style={s.stepNum}>4</Text>
            <Text style={s.stepText}>Buka aplikasi Dompet Bareng dan masuk dengan akun Google.</Text>
          </View>
        </View>

        {/* Back to Web Button */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="arrow-back-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
          <Text style={s.backBtnText}>Kembali ke Versi Web</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  mascotContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: 12,
  },
  mascotImg: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  downloadBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
    ...Shadows.clayButton,
    marginBottom: 24,
  },
  downloadBtnTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  downloadBtnSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  featureGrid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  featureCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    textAlign: 'center',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: 6,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  instructionCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  instructionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primarySoft,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    marginRight: 10,
    marginTop: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
