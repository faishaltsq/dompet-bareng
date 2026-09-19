import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { StatusBar } from 'expo-status-bar';
import { Colors, Shadows, Radius } from '@/constants/theme';

export default function LoginScreen() {
  const { signInWithGoogle, signInDevGuest } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 15_000);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert(t('alertLoginFailed'), e?.message || t('alertFailed'));
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setLoading(true);
    // Tidak await — onAuthStateChange otomatis redirect setelah login sukses
    // Timeout safety 10 detik supaya spinner tidak stuck selamanya
    const timeout = setTimeout(() => setLoading(false), 10_000);
    try {
      await signInDevGuest();
    } catch (_) {
      // error sudah dilog di AuthContext
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* Hero Area — mascot + branding */}
      <View style={s.hero}>
        <View style={s.mascotWrap}>
          <Image
            source={require('@/assets/images/app-mascot-wallet.png')}
            style={s.mascotImg}
            resizeMode="contain"
          />
        </View>
        <Text style={s.title}>DompetBareng</Text>
        <Text style={s.subtitle}>{t('loginSubtitle')}</Text>
      </View>

      {/* Clay bottom sheet */}
      <View style={s.content}>
        <TouchableOpacity
          style={[s.googleBtn, loading && { opacity: 0.6 }]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <Text style={s.googleIcon}>G</Text>
              <Text style={s.googleText}>Masuk dengan Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Dengan masuk, kamu menyetujui{' '}
          <Text
            style={s.disclaimerLink}
            onPress={() => WebBrowser.openBrowserAsync('https://dompet-bareng.vercel.app/terms')}
          >
            Ketentuan Layanan
          </Text>
          {' '}dan{' '}
          <Text
            style={s.disclaimerLink}
            onPress={() => WebBrowser.openBrowserAsync('https://dompet-bareng.vercel.app/privacy')}
          >
            Kebijakan Privasi
          </Text>
          .
        </Text>

        {/* Dev bypass: hanya tampil saat development */}
        {__DEV__ && (
          <TouchableOpacity
            style={s.devBtn}
            onPress={handleDevLogin}
            disabled={loading}
          >
            <Text style={s.devBtnText}>🧪 Masuk Mode Dev / Tester</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryDark },

  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  mascotWrap: {
    width: 180,
    height: 180,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.clayFloat,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  mascotImg: { width: 156, height: 156 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24 },

  content: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 16,
    borderTopWidth: 1,
    borderColor: Colors.border,
    ...Shadows.clayFloat,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 16,
    ...Shadows.clayButton,
  },
  googleIcon: { fontSize: 22, fontWeight: '800', color: '#4285F4' },
  googleText: { fontSize: 16, fontWeight: '700', color: Colors.textDark },

  disclaimer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  disclaimerLink: { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  devBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    opacity: 0.7,
  },
  devBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
