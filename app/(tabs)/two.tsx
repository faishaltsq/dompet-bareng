import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useWorkspace, Workspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, Shadows, Radius } from '@/constants/theme';
import {
  scheduleDailyReminder,
  cancelAllReminders,
  sendTestNotification,
  isReminderEnabled,
} from '@/lib/notifications';

type Member = {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_name?: string;
  email?: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, updateDisplayName, signInWithGoogle } = useAuth();

  const isRegisteredUser = Boolean(user && !user.is_anonymous && (user.email || user.app_metadata?.provider === 'google'));
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    deleteWorkspace,
    updateWorkspace,
    generateInviteLink,
    uploadWorkspaceImage,
    leaveWorkspace,
    removeMember,
  } = useWorkspace();

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Edit profile name modal
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [savingProfileName, setSavingProfileName] = useState(false);

  // Switch workspace modal
  const [switchWsModalVisible, setSwitchWsModalVisible] = useState(false);

  // Edit workspace name modal
  const [editWsModalVisible, setEditWsModalVisible] = useState(false);
  const [editWsName, setEditWsName] = useState('');
  const [savingWsEdit, setSavingWsEdit] = useState(false);

  // Kick member modal with reason
  const [kickModalVisible, setKickModalVisible] = useState(false);
  const [memberToKick, setMemberToKick] = useState<Member | null>(null);
  const [kickReason, setKickReason] = useState('');
  const [kicking, setKicking] = useState(false);

  // Join workspace modal
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinInput, setJoinInput] = useState('');

  // Loading states
  const [deletingWs, setDeletingWs] = useState(false);
  const [leavingWs, setLeavingWs] = useState(false);

  // Daily reminder state
  const [dailyReminder, setDailyReminder] = useState(false);

  useEffect(() => {
    isReminderEnabled().then(setDailyReminder);
  }, []);

  const handleToggleReminder = async (val: boolean) => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Notifikasi lokal hanya tersedia di aplikasi Android & iOS.');
      return;
    }
    setDailyReminder(val);
    if (val) {
      await scheduleDailyReminder(20, 0);
      Alert.alert('Aktif! 🔔', 'Pengingat harian dijadwalkan setiap jam 20:00.');
    } else {
      await cancelAllReminders();
    }
  };

  const handleTestNotification = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Notifikasi hanya tersedia di Android & iOS.');
      return;
    }
    await sendTestNotification();
    Alert.alert('Test Dikirim 🔔', 'Notifikasi akan muncul dalam 3 detik. Minimize app-nya dulu!');
  };

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, joined_at, profiles(display_name, email)')
      .eq('workspace_id', activeWorkspace.id);

    if (!error && data) {
      setMembers(data.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: m.profiles?.display_name ?? null,
        email: m.profiles?.email ?? null,
      })));
    }
    setLoadingMembers(false);
  }, [activeWorkspace]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ── Profile Handlers ──────────────────────────────────────────────────────

  const handleOpenEditProfile = () => {
    setProfileNameInput(profile?.display_name || user?.user_metadata?.full_name || '');
    setEditProfileModalVisible(true);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoggingIn(true);
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Gagal Masuk', e?.message || 'Terjadi kesalahan saat masuk dengan Google.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSaveProfileName = async () => {
    const trimmed = profileNameInput.trim();
    if (!trimmed) {
      Alert.alert('Perhatian', 'Nama profil tidak boleh kosong.');
      return;
    }
    setSavingProfileName(true);
    const ok = await updateDisplayName(trimmed);
    setSavingProfileName(false);
    if (ok) {
      setEditProfileModalVisible(false);
      fetchMembers();
      Alert.alert('Berhasil', 'Nama profil berhasil diperbarui.');
    } else {
      Alert.alert('Gagal', 'Tidak dapat memperbarui nama profil.');
    }
  };

  // ── Workspace Handlers ────────────────────────────────────────────────────

  const handlePickWorkspaceImage = async () => {
    if (!activeWorkspace) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Dibutuhkan', 'Izinkan akses galeri untuk mengganti foto dompet.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      const url = await uploadWorkspaceImage(activeWorkspace.id, result.assets[0].uri);
      setUploadingImage(false);
      if (!url) {
        Alert.alert('Gagal', 'Tidak dapat mengunggah gambar. Pastikan bucket storage aktif.');
      }
    }
  };

  const handleSaveWsEdit = async () => {
    if (!activeWorkspace || !editWsName.trim()) return;
    setSavingWsEdit(true);
    const ok = await updateWorkspace(activeWorkspace.id, editWsName.trim());
    setSavingWsEdit(false);
    if (ok) setEditWsModalVisible(false);
    else Alert.alert('Gagal', 'Tidak dapat mengubah nama dompet.');
  };

  const handleDeleteWorkspace = () => {
    if (!activeWorkspace) return;
    Alert.alert(
      'Hapus Dompet?',
      `Seluruh data transaksi di dompet "${activeWorkspace.name}" akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Dompet',
          style: 'destructive',
          onPress: async () => {
            setDeletingWs(true);
            const ok = await deleteWorkspace(activeWorkspace.id);
            setDeletingWs(false);
            if (!ok) {
              Alert.alert('Gagal', 'Gagal menghapus dompet. Hanya pembuat dompet yang dapat menghapus.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveWorkspace = () => {
    if (!activeWorkspace) return;
    Alert.alert(
      'Keluar dari Dompet?',
      `Kamu tidak akan dapat mengakses riwayat transaksi "${activeWorkspace.name}" lagi.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar Dompet',
          style: 'destructive',
          onPress: async () => {
            setLeavingWs(true);
            const ok = await leaveWorkspace(activeWorkspace.id);
            setLeavingWs(false);
            if (!ok) {
              Alert.alert('Gagal', 'Tidak dapat keluar dari dompet.');
            }
          },
        },
      ]
    );
  };

  const handleKickMember = (targetMember: Member) => {
    if (!activeWorkspace) return;
    setMemberToKick(targetMember);
    setKickReason('');
    setKickModalVisible(true);
  };

  const handleConfirmKick = async () => {
    if (!activeWorkspace || !memberToKick) return;
    setKicking(true);
    try {
      const ok = await removeMember(activeWorkspace.id, memberToKick.user_id, kickReason);
      if (ok) {
        setKickModalVisible(false);
        setMemberToKick(null);
        setKickReason('');
        fetchMembers();
        Alert.alert('Berhasil! 👋', 'Anggota telah dikeluarkan dan diberi notifikasi.');
      } else {
        Alert.alert('Gagal', 'Tidak dapat mengeluarkan anggota. Pastikan kamu memiliki hak admin.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setKicking(false);
    }
  };

  const handleShare = async () => {
    if (!isRegisteredUser) {
      Alert.alert(
        'Login Diperlukan 🔐',
        'Kamu harus masuk dengan akun Google terlebih dahulu sebelum dapat mengundang anggota ke dompet ini.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Masuk Sekarang',
            onPress: () => router.push('/(auth)/login' as any),
          },
        ]
      );
      return;
    }
    setSharing(true);
    await generateInviteLink();
    setSharing(false);
  };

  const handleJoinWithInput = () => {
    const raw = joinInput.trim();
    if (!raw) {
      Alert.alert('Perhatian', 'Tempel link atau kode undangan terlebih dahulu.');
      return;
    }
    const token = raw.replace(/^.*invite\//i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (!token) {
      Alert.alert('Gagal', 'Format link atau kode undangan tidak valid.');
      return;
    }
    setJoinModalVisible(false);
    setJoinInput('');
    router.push(`/invite/${token}` as any);
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      // Alert.alert tidak support tombol di web
      if (window.confirm('Keluar Akun — Apakah kamu yakin ingin keluar?')) {
        signOut();
      }
    } else {
      Alert.alert('Keluar Akun', 'Apakah kamu yakin ingin keluar?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const isAdmin = activeWorkspace?.role === 'admin';
  const googleAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const userInitial = (profile?.display_name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* HEADER */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Text style={s.headerTitle}>Profil & Pengaturan</Text>
          <Text style={s.headerSubtitle}>Kelola akun pribadi dan dompet bersama</Text>
        </View>

        <View style={s.body}>
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: PROFIL PENGGUNA PRIBADI */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>Akun Saya</Text>

          <Animated.View entering={FadeInDown.duration(400)} style={s.userCard}>
            <View style={s.userCardMainRow}>
              <View style={s.userAvatarWrapper}>
                {googleAvatarUrl ? (
                  <Image source={{ uri: googleAvatarUrl }} style={s.userAvatarImage} />
                ) : (
                  <View style={s.userAvatarPlaceholder}>
                    <Text style={s.userAvatarInitial}>{userInitial}</Text>
                  </View>
                )}
                {!isRegisteredUser && (
                  <View style={s.googleAvatarBadge}>
                    <Text style={s.googleAvatarBadgeText}>G</Text>
                  </View>
                )}
              </View>

              <View style={s.userInfo}>
                <View style={s.userNameRow}>
                  <Text style={s.userName} numberOfLines={1}>
                    {profile?.display_name || user?.user_metadata?.full_name || 'Pengguna'}
                  </Text>
                  <TouchableOpacity onPress={handleOpenEditProfile} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.editNameIcon}>✏️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.userEmailText} numberOfLines={1}>
                  {user?.email || 'Tamu / Mode Dev'}
                </Text>
                <View style={[s.authBadge, isRegisteredUser ? s.authBadgeGoogle : s.authBadgeGuest]}>
                  {!isRegisteredUser && (
                    <Text style={s.googleMiniIcon}>G</Text>
                  )}
                  <Text style={[s.authBadgeText, isRegisteredUser ? s.authBadgeTextGoogle : s.authBadgeTextGuest]}>
                    {isRegisteredUser ? '✓ Akun Google Terhubung' : 'Belum Login Google'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tombol Login Google jika belum login */}
            {!isRegisteredUser && (
              <TouchableOpacity
                style={s.googleLoginBtn}
                onPress={handleGoogleLogin}
                disabled={loggingIn}
                activeOpacity={0.85}
              >
                {loggingIn ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <>
                    <View style={s.googleIconCircle}>
                      <Text style={s.googleIconChar}>G</Text>
                    </View>
                    <Text style={s.googleLoginBtnText}>Masuk dengan Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: DOMPET AKTIF & WORKSPACE SWITCHER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>Dompet Aktif</Text>

          <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.wsActiveCard}>
            <View style={s.wsActiveHeader}>
              <TouchableOpacity
                onPress={handlePickWorkspaceImage}
                style={s.wsImageWrapper}
                activeOpacity={isAdmin ? 0.7 : 1}
                disabled={!isAdmin}
              >
                {activeWorkspace?.image_url ? (
                  <Image source={{ uri: activeWorkspace.image_url }} style={s.wsImage} />
                ) : (
                  <View style={s.wsImagePlaceholder}>
                    <Text style={{ fontSize: 28 }}>💰</Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={s.wsCameraBadge}>
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 10 }}>📷</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>

              <View style={s.wsActiveInfo}>
                <Text style={s.wsActiveName} numberOfLines={1}>
                  {activeWorkspace?.name || 'Pilih Dompet'}
                </Text>
                <View style={[s.rolePill, isAdmin ? s.rolePillAdmin : s.rolePillMember]}>
                  <Text style={[s.rolePillText, isAdmin ? s.rolePillTextAdmin : s.rolePillTextMember]}>
                    {isAdmin ? '👑 Pemilik / Admin' : '👤 Anggota'}
                  </Text>
                </View>
              </View>

              {/* Tombol Pindah Dompet */}
              <TouchableOpacity
                style={s.switchWsBtn}
                onPress={() => setSwitchWsModalVisible(true)}
              >
                <Text style={s.switchWsBtnText}>Pindah ›</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: MANAJEMEN DOMPET (GATED BY ROLE) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>Pengaturan Dompet</Text>

          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={s.menuGroup}>
            {/* Ubah Nama Dompet (Admin only) */}
            {isAdmin && (
              <TouchableOpacity
                style={s.menuRow}
                onPress={() => {
                  setEditWsName(activeWorkspace?.name || '');
                  setEditWsModalVisible(true);
                }}
              >
                <View style={[s.menuIcon, { backgroundColor: Colors.primarySoft }]}>
                  <Text style={{ fontSize: 18 }}>✏️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuTitle}>Ubah Nama Dompet</Text>
                  <Text style={s.menuDesc}>Ganti nama dompet aktif ini</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Ganti Foto Dompet (Admin only) */}
            {isAdmin && (
              <TouchableOpacity style={s.menuRow} onPress={handlePickWorkspaceImage}>
                <View style={[s.menuIcon, { backgroundColor: Colors.accentBlueSoft }]}>
                  <Text style={{ fontSize: 18 }}>🖼️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuTitle}>Ganti Foto Dompet</Text>
                  <Text style={s.menuDesc}>Unggah ikon atau foto profil dompet</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Undang Anggota */}
            <TouchableOpacity style={s.menuRow} onPress={handleShare} disabled={sharing}>
              <View style={[s.menuIcon, { backgroundColor: Colors.savingsSoft }]}>
                <Text style={{ fontSize: 18 }}>🔗</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>Undang Anggota</Text>
                <Text style={s.menuDesc}>Bagikan link ke keluarga atau rekan</Text>
              </View>
              {sharing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={s.menuArrow}>›</Text>
              )}
            </TouchableOpacity>

            {/* KELUAR DARI DOMPET (Hanya Member non-admin) */}
            {!isAdmin && (
              <TouchableOpacity
                style={[s.menuRow, s.menuRowDanger]}
                onPress={handleLeaveWorkspace}
                disabled={leavingWs}
              >
                <View style={[s.menuIcon, { backgroundColor: Colors.expenseSoft }]}>
                  <Text style={{ fontSize: 18 }}>🚪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuTitle, { color: Colors.expense }]}>Keluar dari Dompet</Text>
                  <Text style={s.menuDesc}>Tinggalkan dompet bersama ini</Text>
                </View>
                {leavingWs ? (
                  <ActivityIndicator size="small" color={Colors.expense} />
                ) : (
                  <Text style={[s.menuArrow, { color: Colors.expense }]}>›</Text>
                )}
              </TouchableOpacity>
            )}

            {/* HAPUS DOMPET (Hanya Admin) */}
            {isAdmin && (
              <TouchableOpacity
                style={[s.menuRow, s.menuRowDanger]}
                onPress={handleDeleteWorkspace}
                disabled={deletingWs}
              >
                <View style={[s.menuIcon, { backgroundColor: Colors.expenseSoft }]}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuTitle, { color: Colors.expense }]}>Hapus Dompet Ini</Text>
                  <Text style={s.menuDesc}>Hapus seluruh data dompet dan riwayat transaksi</Text>
                </View>
                {deletingWs ? (
                  <ActivityIndicator size="small" color={Colors.expense} />
                ) : (
                  <Text style={[s.menuArrow, { color: Colors.expense }]}>›</Text>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 4: ANGGOTA DOMPET */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>
            Anggota Dompet ({members.length})
          </Text>

          <Animated.View entering={FadeInDown.delay(140).duration(400)} style={s.menuGroup}>
            {loadingMembers ? (
              <ActivityIndicator color={Colors.primary} style={{ padding: 20 }} />
            ) : (
              members.map((m, idx) => {
                const isMe = m.user_id === user?.id;
                const memberName = m.display_name || m.email?.split('@')[0] || `User #${m.user_id.slice(0, 6)}`;
                return (
                  <View key={m.user_id} style={[s.menuRow, idx === members.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.menuIcon, { backgroundColor: Colors.borderLight }]}>
                      <Text style={{ fontSize: 18 }}>{m.role === 'admin' ? '👑' : '👤'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.menuTitle}>
                        {isMe ? `${memberName} (Kamu)` : memberName}
                      </Text>
                      <Text style={s.menuDesc}>
                        {m.email ? m.email : `Bergabung ${new Date(m.joined_at).toLocaleDateString('id-ID')}`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.badgeSmall, m.role === 'admin' && s.badgeSmallAdmin]}>
                        <Text style={[s.badgeSmallText, m.role === 'admin' && s.badgeSmallTextAdmin]}>
                          {m.role === 'admin' ? 'Admin' : 'Member'}
                        </Text>
                      </View>
                      {/* Kick button: admin can remove other members */}
                      {isAdmin && !isMe && (
                        <TouchableOpacity
                          onPress={() => handleKickMember(m)}
                          style={s.kickBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={s.kickBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 5: LAINNYA (GABUNG DOMPET & KELUAR AKUN) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>Lainnya</Text>

          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.menuGroup}>
            <TouchableOpacity style={s.menuRow} onPress={() => setJoinModalVisible(true)}>
              <View style={[s.menuIcon, { backgroundColor: '#F3E8FF' }]}>
                <Text style={{ fontSize: 18 }}>📥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>Gabung Dompet Lain</Text>
                <Text style={s.menuDesc}>Masukkan tautan atau kode token undangan</Text>
              </View>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>

            {/* Pengingat Harian Toggle */}
            <View style={s.menuRow}>
              <View style={[s.menuIcon, { backgroundColor: Colors.savingsSoft }]}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>Pengingat Harian</Text>
                <Text style={s.menuDesc}>Notifikasi jam 20:00 untuk mencatat pengeluaran</Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={handleToggleReminder}
                trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                thumbColor={dailyReminder ? Colors.primary : Colors.textMuted}
              />
            </View>

            {/* Test Notifikasi */}
            <View style={[s.menuRow, { borderBottomWidth: 0 }]}>
              <View style={[s.menuIcon, { backgroundColor: Colors.accentBlueSoft }]}>
                <Text style={{ fontSize: 18 }}>🧪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>Test Notifikasi</Text>
                <Text style={s.menuDesc}>Kirim notifikasi uji dalam 3 detik</Text>
              </View>
              <TouchableOpacity
                onPress={handleTestNotification}
                style={s.testNotifBtn}
              >
                <Text style={s.testNotifBtnText}>Coba</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* KELUAR AKUN */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)} style={{ marginTop: 20 }}>
            <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
              <Text style={s.signOutBtnText}>Keluar dari Akun</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* ── MODAL 1: EDIT PROFILE DISPLAY NAME ── */}
      <Modal visible={editProfileModalVisible} transparent animationType="fade" onRequestClose={() => setEditProfileModalVisible(false)}>
        <View style={s.modalOverlay}>
          <Animated.View entering={SlideInDown.springify()} style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Ubah Nama Profil</Text>
            <Text style={s.sheetSubtitle}>Nama ini akan muncul pada transaksi dan daftar anggota dompet bersama.</Text>

            <TextInput
              style={s.sheetInput}
              value={profileNameInput}
              onChangeText={setProfileNameInput}
              placeholder="Contoh: Budi Pratama"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <TouchableOpacity
              style={[s.sheetBtn, savingProfileName && { opacity: 0.6 }]}
              onPress={handleSaveProfileName}
              disabled={savingProfileName}
            >
              {savingProfileName ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.sheetBtnText}>Simpan Nama</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── MODAL 2: SWITCH WORKSPACE ── */}
      <Modal visible={switchWsModalVisible} transparent animationType="fade" onRequestClose={() => setSwitchWsModalVisible(false)}>
        <View style={s.modalOverlay}>
          <Animated.View entering={SlideInDown.springify()} style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Pilih Dompet</Text>
            <Text style={s.sheetSubtitle}>Beralih ke dompet bersama lainnya:</Text>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {workspaces.map(ws => {
                const isActive = ws.id === activeWorkspace?.id;
                return (
                  <TouchableOpacity
                    key={ws.id}
                    style={[s.wsPickerRow, isActive && s.wsPickerRowActive]}
                    onPress={() => {
                      setActiveWorkspace(ws);
                      setSwitchWsModalVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{ws.image_url ? '🖼️' : '💰'}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[s.wsPickerName, isActive && { color: Colors.primary, fontWeight: '800' }]}>
                        {ws.name}
                      </Text>
                      <Text style={s.wsPickerRole}>
                        {ws.role === 'admin' ? '👑 Pemilik' : '👤 Anggota'}
                      </Text>
                    </View>
                    {isActive && <Text style={{ color: Colors.primary, fontWeight: '800', fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity onPress={() => setSwitchWsModalVisible(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Tutup</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── MODAL 3: EDIT WORKSPACE NAME ── */}
      <Modal visible={editWsModalVisible} transparent animationType="fade" onRequestClose={() => setEditWsModalVisible(false)}>
        <View style={s.modalOverlay}>
          <Animated.View entering={SlideInDown.springify()} style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Ubah Nama Dompet</Text>

            <TextInput
              style={s.sheetInput}
              value={editWsName}
              onChangeText={setEditWsName}
              placeholder="Nama dompet baru"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <TouchableOpacity
              style={[s.sheetBtn, savingWsEdit && { opacity: 0.6 }]}
              onPress={handleSaveWsEdit}
              disabled={savingWsEdit}
            >
              {savingWsEdit ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.sheetBtnText}>Simpan Perubahan</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setEditWsModalVisible(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── MODAL 4: GABUNG WORKSPACE ── */}
      <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={() => setJoinModalVisible(false)}>
        <View style={s.modalOverlay}>
          <Animated.View entering={SlideInDown.springify()} style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Gabung Dompet Lain</Text>
            <Text style={s.sheetSubtitle}>Tempel tautan undangan atau kode token yang kamu terima:</Text>

            <TextInput
              style={s.sheetInput}
              value={joinInput}
              onChangeText={setJoinInput}
              placeholder="dompetbareng://invite/... atau kode token"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={s.sheetBtn} onPress={handleJoinWithInput}>
              <Text style={s.sheetBtnText}>Lanjut Gabung</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={s.cancelBtn}>
              <Text style={s.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── MODAL 5: KICK MEMBER CONFIRMATION WITH REASON ── */}
      <Modal visible={kickModalVisible} transparent animationType="fade" onRequestClose={() => setKickModalVisible(false)}>
        <View style={s.modalOverlay}>
          <Animated.View entering={SlideInDown.springify()} style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 22 }}>⚠️</Text>
              <Text style={s.sheetTitle}>Keluarkan Anggota</Text>
            </View>

            <Text style={s.sheetSubtitle}>
              Apakah kamu yakin ingin mengeluarkan{' '}
              <Text style={{ fontWeight: '700', color: Colors.textDark }}>
                {memberToKick?.display_name || memberToKick?.email || 'anggota ini'}
              </Text>{' '}
              dari dompet "{activeWorkspace?.name}"?
            </Text>

            <View style={{ marginTop: 12, marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textDark, marginBottom: 6 }}>
                Alasan Dikeluarkan (dikirim ke anggota via notifikasi):
              </Text>
              <TextInput
                style={[s.sheetInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={kickReason}
                onChangeText={setKickReason}
                placeholder="Tuliskan alasan (misal: Tidak aktif, salah gabung, dll)..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[s.sheetBtn, { backgroundColor: Colors.expense }, kicking && { opacity: 0.6 }]}
              onPress={handleConfirmKick}
              disabled={kicking}
            >
              {kicking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.sheetBtnText}>Ya, Keluarkan & Beri Tahu</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setKickModalVisible(false)}
              style={s.cancelBtn}
              disabled={kicking}
            >
              <Text style={s.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  body: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 16,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── User Card ─────────────────────────────────────────────────────────────
  userCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  userCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userAvatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    position: 'relative',
  },
  googleAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#4285F4',
  },
  googleAvatarBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4285F4',
  },
  userAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  editNameIcon: {
    fontSize: 14,
  },
  userEmailText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  authBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  authBadgeGoogle: {
    backgroundColor: '#E8F5E9',
  },
  authBadgeGuest: {
    backgroundColor: '#FFF3E0',
  },
  authBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  authBadgeTextGoogle: {
    color: '#2E7D32',
  },
  authBadgeTextGuest: {
    color: '#E65100',
  },
  googleMiniIcon: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4285F4',
  },

  // ── Google Login Button in User Card ──
  googleLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4285F4',
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...Shadows.card,
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconChar: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  googleLoginBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
  },

  // ── Active Workspace Card ──────────────────────────────────────────────────
  wsActiveCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  wsActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wsImageWrapper: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.savingsSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  wsImage: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  wsImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsActiveInfo: {
    flex: 1,
    gap: 4,
  },
  wsActiveName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  rolePillAdmin: {
    backgroundColor: Colors.primarySoft,
  },
  rolePillMember: {
    backgroundColor: Colors.accentBlueSoft,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rolePillTextAdmin: {
    color: Colors.primaryDark,
  },
  rolePillTextMember: {
    color: Colors.accentBlue,
  },
  switchWsBtn: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  switchWsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Menu Group & Rows ──────────────────────────────────────────────────────
  menuGroup: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuRowDanger: {
    backgroundColor: '#FFF9F9',
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  menuDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  testNotifBtn: {
    backgroundColor: Colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: Colors.accentBlue,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  testNotifBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentBlue,
  },
  menuArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.border,
  },
  badgeSmallAdmin: {
    backgroundColor: Colors.primarySoft,
  },
  badgeSmallText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  badgeSmallTextAdmin: {
    color: Colors.primary,
    fontWeight: '700',
  },
  kickBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.expenseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFD7DB',
  },
  kickBtnText: {
    color: Colors.expense,
    fontSize: 12,
    fontWeight: '800',
  },

  signOutBtn: {
    backgroundColor: Colors.expenseSoft,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD7DB',
  },
  signOutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.expense,
  },

  // ── Workspace Picker List (Inside Modal) ────────────────────────────────────
  wsPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  wsPickerRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  wsPickerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  wsPickerRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── Modals ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 24,
    gap: 12,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderDark,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sheetInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: Colors.background,
    color: Colors.textDark,
  },
  sheetBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    ...Shadows.float,
  },
  sheetBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
