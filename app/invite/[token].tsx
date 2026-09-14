import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Colors, Shadows, Radius } from '@/constants/theme';

export default function JoinWorkspaceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signInWithGoogle, signInDevGuest } = useAuth();
  const { joinWorkspace } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cek apakah user sudah login dengan akun riil (Google / email terdaftar) bukan anonim
  const isRegisteredUser = Boolean(user && !user.is_anonymous && (user.email || user.app_metadata?.provider === 'google'));

  useEffect(() => {
    if (!token) {
      setErrorMsg('Token undangan tidak ditemukan.');
      setLoading(false);
      return;
    }

    const checkInvite = async () => {
      const { data, error } = await supabase
        .from('workspace_invites')
        .select('workspace_id, workspaces(id, name), expires_at')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setErrorMsg('Tautan undangan tidak valid atau masa berlakunya sudah habis.');
      } else {
        const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : (data.workspaces as any);
        if (ws && ws.id) {
          setWorkspace({ id: ws.id, name: ws.name || 'Dompet Bersama' });
        } else if (data.workspace_id) {
          setWorkspace({ id: data.workspace_id, name: 'Dompet Bersama' });
        } else {
          setErrorMsg('Data dompet tidak ditemukan.');
        }
      }
      setLoading(false);
    };

    checkInvite();
  }, [token]);

  const handleGoogleLogin = async () => {
    try {
      setLoggingIn(true);
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Gagal Login', e?.message || 'Terjadi kesalahan saat login Google.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleJoin = async () => {
    if (!workspace) return;
    setJoining(true);

    try {
      const ok = await joinWorkspace(workspace.id, 'member');
      if (ok) {
        Alert.alert('Berhasil! 🎉', `Kamu resmi bergabung dengan dompet "${workspace.name}"`);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Gagal', 'Tidak dapat bergabung. Pastikan kamu memiliki izin atau tautan belum kedaluwarsa.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Memeriksa tautan undangan...</Text>
      </View>
    );
  }

  if (errorMsg || !workspace) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: 28 }]}>
        <Text style={{ fontSize: 54, marginBottom: 8 }}>⚠️</Text>
        <Text style={styles.title}>Tidak Dapat Bergabung</Text>
        <Text style={styles.desc}>{errorMsg ?? 'Terjadi kesalahan memuat tautan.'}</Text>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.outlineBtnText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ICON & JUDUL */}
        <View style={styles.iconCircle}>
          <Text style={{ fontSize: 40 }}>👥</Text>
        </View>

        <Text style={styles.headerSubtitle}>Undangan Bergabung</Text>
        <Text style={styles.workspaceName}>{workspace.name}</Text>
        <Text style={styles.leadDesc}>
          Kamu diundang untuk mengelola keuangan bersama di dompet ini.
        </Text>

        {/* KARTU STATUS USER */}
        <View style={styles.infoCard}>
          {isRegisteredUser ? (
            <View>
              <View style={styles.cardHeaderRow}>
                <Text style={{ fontSize: 16 }}>✅</Text>
                <Text style={styles.cardHeaderTitle}>Akun Terhubung</Text>
              </View>
              <Text style={styles.userEmailText}>{user?.email}</Text>
              <Text style={styles.cardSubText}>
                Kamu akan bergabung sebagai anggota menggunakan akun di atas.
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.cardHeaderRow}>
                <Text style={{ fontSize: 16 }}>🔐</Text>
                <Text style={styles.cardHeaderTitle}>Login Diperlukan</Text>
              </View>
              <Text style={styles.cardSubText}>
                Untuk bergabung dengan dompet bersama orang lain, kamu harus login dengan akun Google agar identitasmu terverifikasi dan transaksi tersinkronisasi.
              </Text>
            </View>
          )}
        </View>

        {/* ACTION BUTTON */}
        {isRegisteredUser ? (
          <TouchableOpacity
            style={[styles.primaryBtn, joining && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Gabung ke Dompet Ini</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: '100%', gap: 12 }}>
            <TouchableOpacity
              style={[styles.googleBtn, loggingIn && styles.btnDisabled]}
              onPress={handleGoogleLogin}
              disabled={loggingIn}
            >
              {loggingIn ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text style={styles.googleBtnText}>Masuk dengan Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Dev tester bypass fallback jika di-development */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.devBtn}
                onPress={async () => {
                  setLoggingIn(true);
                  await signInDevGuest();
                  setLoggingIn(false);
                }}
              >
                <Text style={styles.devBtnText}>🧪 Masuk Mode Tester (Dev Staging)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.cancelBtnText}>Batal</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.savingsSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.card,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  workspaceName: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textDark,
    marginTop: 4,
    textAlign: 'center',
  },
  leadDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 24,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    ...Shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  userEmailText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 4,
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  googleBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 15,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...Shadows.card,
  },
  googleBtnText: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '700',
  },
  devBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  devBtnText: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cancelBtn: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelBtnText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.full,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
});
