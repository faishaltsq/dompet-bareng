import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { Colors, Shadows } from '@/constants/theme';

export default function LoginScreen() {
  const { signInWithGoogle, signInDevGuest } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 15_000);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Login Gagal', e?.message || 'Coba lagi.');
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

      {/* Purple hero */}
      <View style={s.hero}>
        <Text style={s.logo}>💰</Text>
        <Text style={s.title}>DompetBareng</Text>
        <Text style={s.subtitle}>Manajemen keuangan bersama{'\n'}untuk keluarga & organisasi</Text>
      </View>

      {/* White content area */}
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
          Dengan masuk, kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi.
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
  root: { flex: 1, backgroundColor: Colors.primary },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  logo: { fontSize: 72 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 24 },

  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 16,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    ...Shadows.card,
  },
  googleIcon: { fontSize: 22, fontWeight: '800', color: '#4285F4' },
  googleText: { fontSize: 16, fontWeight: '700', color: Colors.textDark },

  disclaimer: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  devBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    opacity: 0.7,
  },
  devBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
