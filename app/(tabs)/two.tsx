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
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SwipeableModal from '@/components/SwipeableModal';

import { useWorkspace, Workspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Colors, Shadows, Radius } from '@/constants/theme';
import {
  scheduleDailyReminder,
  cancelAllReminders,
  isReminderEnabled,
} from '@/lib/notifications';
import { checkAndApplyUpdate, getCurrentUpdateInfo } from '@/lib/updates';

type Member = {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_name?: string;
  email?: string;
  avatar_url?: string | null;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, updateDisplayName, signInWithGoogle, avatarUrl } = useAuth();
  const { language, setLanguage, t } = useLanguage();

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
      Alert.alert(t('alertNotifWebTitle'), t('alertNotifWebBody'));
      return;
    }
    setDailyReminder(val);
    if (val) {
      await scheduleDailyReminder(20, 0);
      Alert.alert(t('alertReminderActive'), t('alertReminderBody'));
    } else {
      await cancelAllReminders();
    }
  };

  // OTA Update
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updatePhase, setUpdatePhase] = useState<'idle' | 'checking' | 'downloading' | 'done'>('idle');
  const [updateResult, setUpdateResult] = useState<{ status: string; message: string } | null>(null);

  const handleCheckUpdate = async () => {
    setUpdatePhase('checking');
    setCheckingUpdate(true);
    setUpdateResult(null);

    const result = await checkAndApplyUpdate();

    // Jika ada update → tunjukkan fase downloading sebelum reload
    if (result.status === 'updated') {
      setUpdatePhase('downloading');
      // reloadAsync() sudah dipanggil di dalam checkAndApplyUpdate, tapi
      // jika kita sampai di sini artinya belum reload → tampilkan hasil saja
    }

    setUpdatePhase('done');
    setCheckingUpdate(false);
    setUpdateResult(result);
  };

  const updateInfo = getCurrentUpdateInfo();

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, joined_at, profiles(display_name, email, avatar_url)')
      .eq('workspace_id', activeWorkspace.id);

    if (!error && data) {
      setMembers(data.map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: m.profiles?.display_name ?? null,
        email: m.profiles?.email ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      })));
    }
    setLoadingMembers(false);
  }, [activeWorkspace]);

  useEffect(() => {
    fetchMembers();

    if (!activeWorkspace) return;

    // Realtime channel: update anggota otomatis saat ada yang bergabung / keluar
    const channel = supabase
      .channel(`ws_members:${activeWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${activeWorkspace.id}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMembers, activeWorkspace?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [fetchMembers])
  );

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
      Alert.alert(t('alertFailed'), e?.message || t('alertGoogleLoginFailed'));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSaveProfileName = async () => {
    const trimmed = profileNameInput.trim();
    if (!trimmed) {
      Alert.alert(t('alertAttention'), t('alertProfileNameEmpty'));
      return;
    }
    setSavingProfileName(true);
    const ok = await updateDisplayName(trimmed);
    setSavingProfileName(false);
    if (ok) {
      setEditProfileModalVisible(false);
      fetchMembers();
      Alert.alert(t('alertSuccess'), t('alertProfileUpdated'));
    } else {
      Alert.alert(t('alertFailed'), t('alertProfileUpdateFailed'));
    }
  };

  // ── Workspace Handlers ────────────────────────────────────────────────────

  const handlePickWorkspaceImage = async () => {
    if (!activeWorkspace) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('alertPermissionRequired'), t('alertGalleryPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      const url = await uploadWorkspaceImage(
        activeWorkspace.id,
        result.assets[0].uri,
        result.assets[0].base64
      );
      setUploadingImage(false);
      if (!url) {
        Alert.alert(t('alertFailed'), t('alertUploadImageFailed'));
      }
    }
  };

  const handleSaveWsEdit = async () => {
    if (!activeWorkspace || !editWsName.trim()) return;
    setSavingWsEdit(true);
    const ok = await updateWorkspace(activeWorkspace.id, editWsName.trim());
    setSavingWsEdit(false);
    if (ok) setEditWsModalVisible(false);
    else Alert.alert(t('alertFailed'), t('alertRenameWalletFailed'));
  };

  const handleDeleteWorkspace = () => {
    if (!activeWorkspace) return;
    Alert.alert(
      t('alertDeleteWallet'),
      `${t('alertDeleteWalletBody')} ("${activeWorkspace.name}")`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('alertDeleteWalletBtn'),
          style: 'destructive',
          onPress: async () => {
            setDeletingWs(true);
            const ok = await deleteWorkspace(activeWorkspace.id);
            setDeletingWs(false);
            if (!ok) {
              Alert.alert(t('alertFailed'), t('alertDeleteWalletFailed'));
            }
          },
        },
      ]
    );
  };

  const handleLeaveWorkspace = () => {
    if (!activeWorkspace) return;
    Alert.alert(
      t('alertLeaveWallet'),
      `${t('alertLeaveWalletBody')} ("${activeWorkspace.name}")`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('alertLeaveWalletBtn'),
          style: 'destructive',
          onPress: async () => {
            setLeavingWs(true);
            const ok = await leaveWorkspace(activeWorkspace.id);
            setLeavingWs(false);
            if (!ok) {
              Alert.alert(t('alertFailed'), t('alertLeaveWalletFailed'));
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
        Alert.alert(t('alertSuccess'), t('alertKickSuccess'));
      } else {
        Alert.alert(t('alertFailed'), t('alertKickFailed'));
      }
    } catch (e: any) {
      Alert.alert(t('alertError'), e?.message || t('alertSystemError'));
    } finally {
      setKicking(false);
    }
  };

  const handleShare = async () => {
    if (!isRegisteredUser) {
      Alert.alert(
        t('alertLoginRequired'),
        t('alertLoginRequiredBody'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('btnLoginNow'),
            onPress: () => router.push('/(auth)/login' as any),
          },
        ]
      );
      return;
    }
    setSharing(true);
    try {
      const link = await generateInviteLink();
      if (link && Platform.OS === 'web') {
        Alert.alert(
          'Link Undangan Berhasil Dibuat 📋',
          `Link undangan sudah disalin ke clipboard:\n\n${link}\n\nBagikan link ini ke temanmu agar mereka bisa bergabung!`
        );
      } else if (!link) {
        Alert.alert(t('alertFailed'), 'Tidak dapat membuat link undangan. Pastikan kamu terhubung ke internet.');
      }
    } catch (e: any) {
      Alert.alert(t('alertError'), e?.message || t('alertSystemError'));
    } finally {
      setSharing(false);
    }
  };

  const handleJoinWithInput = () => {
    const raw = joinInput.trim();
    if (!raw) {
      Alert.alert(t('alertAttention'), t('alertJoinInputEmpty'));
      return;
    }
    const token = raw.replace(/^.*invite\//i, '').replace(/[^a-zA-Z0-9]/g, '');
    if (!token) {
      Alert.alert(t('alertFailed'), t('alertJoinFormatInvalid'));
      return;
    }
    setJoinModalVisible(false);
    setJoinInput('');
    router.push(`/invite/${token}` as any);
  };

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      // Alert.alert tidak support tombol di web
      if (window.confirm(`${t('alertSignOutTitle')} — ${t('alertSignOutBody')}`)) {
        signOut();
      }
    } else {
      Alert.alert(t('alertSignOutTitle'), t('alertSignOutBody'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('btnSignOut'), style: 'destructive', onPress: signOut },
      ]);
    }
  };

  const isAdmin = activeWorkspace?.role === 'admin';
  const googleAvatarUrl = avatarUrl;
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
          <Text style={s.headerTitle}>{t('settingsTitle')}</Text>
          <Text style={s.headerSubtitle}>{t('settingsSubtitle')}</Text>
        </View>

        <View style={s.body}>
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: PROFIL PENGGUNA PRIBADI */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>{t('myAccount')}</Text>

          <Animated.View entering={FadeInDown.duration(400)} style={s.userCard}>
            <View style={s.userCardMainRow}>
              <View style={s.userAvatarWrapper}>
                {googleAvatarUrl ? (
                  <Image
                    source={{ uri: googleAvatarUrl }}
                    style={s.userAvatarImage}
                    // @ts-ignore
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <View style={s.userAvatarPlaceholder}>
                    <Text style={s.userAvatarInitial}>{userInitial}</Text>
                  </View>
                )}
              </View>

              <View style={s.userInfo}>
                <View style={s.userNameRow}>
                  <Text style={s.userName} numberOfLines={1}>
                    {profile?.display_name || user?.user_metadata?.full_name || t('userFallback')}
                  </Text>
                  <TouchableOpacity onPress={handleOpenEditProfile} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.editNameIcon}>✏️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.userEmailText} numberOfLines={1}>
                  {user?.email || t('devGuestTag')}
                </Text>
                <View style={[s.authBadge, isRegisteredUser ? s.authBadgeGoogle : s.authBadgeGuest]}>
                  {isRegisteredUser && (
                    <Text style={s.googleMiniIcon}>G</Text>
                  )}
                  <Text style={[s.authBadgeText, isRegisteredUser ? s.authBadgeTextGoogle : s.authBadgeTextGuest]}>
                    {isRegisteredUser ? t('googleConnected') : t('googleNotConnected')}
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
                    <Text style={s.googleLoginBtnText}>{t('signInWithGoogle')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: DOMPET AKTIF & WORKSPACE SWITCHER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>{t('activeWalletHeader')}</Text>

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
                    <Ionicons name="wallet-outline" size={28} color={Colors.primary} />
                  </View>
                )}
                {isAdmin && (
                  <View style={s.wsCameraBadge}>
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={11} color="#fff" />
                    )}
                  </View>
                )}
              </TouchableOpacity>

              <View style={s.wsActiveInfo}>
                <Text style={s.wsActiveName} numberOfLines={1}>
                  {activeWorkspace?.name || t('selectWallet')}
                </Text>
                <View style={[s.rolePill, isAdmin ? s.rolePillAdmin : s.rolePillMember]}>
                  <Ionicons
                    name={isAdmin ? 'ribbon-outline' : 'person-outline'}
                    size={11}
                    color={isAdmin ? Colors.primaryDark : Colors.accentBlue}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[s.rolePillText, isAdmin ? s.rolePillTextAdmin : s.rolePillTextMember]}>
                    {isAdmin ? t('roleOwner') : t('roleMember')}
                  </Text>
                </View>
              </View>

              {/* Tombol Pindah Dompet */}
              <TouchableOpacity
                style={s.switchWsBtn}
                onPress={() => setSwitchWsModalVisible(true)}
              >
                <Text style={s.switchWsBtnText}>{t('switchLabel')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: MANAJEMEN DOMPET (GATED BY ROLE) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <Text style={s.sectionHeader}>{t('walletSettings')}</Text>

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
                  <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuTitle}>{t('renameWallet')}</Text>
                  <Text style={s.menuDesc}>{t('renameWalletDesc')}</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Ganti Foto Dompet (Admin only) */}
            {isAdmin && (
              <TouchableOpacity style={s.menuRow} onPress={handlePickWorkspaceImage}>
                <View style={[s.menuIcon, { backgroundColor: Colors.accentBlueSoft }]}>
                  <Ionicons name="image-outline" size={18} color={Colors.accentBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuTitle}>{t('changeWalletPhoto')}</Text>
                  <Text style={s.menuDesc}>{t('changeWalletPhotoDesc')}</Text>
                </View>
                <Text style={s.menuArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Undang Anggota */}
            <TouchableOpacity style={s.menuRow} onPress={handleShare} disabled={sharing}>
              <View style={[s.menuIcon, { backgroundColor: Colors.savingsSoft }]}>
                <Ionicons name="share-social-outline" size={18} color={Colors.savings} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>{t('inviteMembers')}</Text>
                <Text style={s.menuDesc}>{t('inviteMembersDesc')}</Text>
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
                  <Ionicons name="exit-outline" size={18} color={Colors.expense} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuTitle, { color: Colors.expense }]}>{t('leaveWallet')}</Text>
                  <Text style={s.menuDesc}>{t('leaveWalletDesc')}</Text>
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
                  <Ionicons name="trash-outline" size={18} color={Colors.expense} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.menuTitle, { color: Colors.expense }]}>{t('deleteWallet')}</Text>
                  <Text style={s.menuDesc}>{t('deleteWalletDesc')}</Text>
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
            {t('walletMembersTitle')} ({members.length})
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
                    <View style={[s.menuIcon, { backgroundColor: Colors.borderLight, overflow: 'hidden' }]}>
                      {m.avatar_url ? (
                        <Image
                          source={{ uri: m.avatar_url }}
                          style={s.memberAvatarImg}
                          // @ts-ignore
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Ionicons
                          name={m.role === 'admin' ? 'ribbon-outline' : 'person-outline'}
                          size={18}
                          color={m.role === 'admin' ? Colors.savings : Colors.textMuted}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.menuTitle}>
                        {isMe ? `${memberName} ${t('labelMemberSuffix')}` : memberName}
                      </Text>
                      <Text style={s.menuDesc}>
                        {m.email ? m.email : `Bergabung ${new Date(m.joined_at).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US')}`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.badgeSmall, m.role === 'admin' && s.badgeSmallAdmin]}>
                        <Text style={[s.badgeSmallText, m.role === 'admin' && s.badgeSmallTextAdmin]}>
                          {m.role === 'admin' ? t('roleOwner') : t('roleMember')}
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
          <Text style={s.sectionHeader}>{t('othersSection')}</Text>

          <Animated.View entering={FadeInDown.delay(180).duration(400)} style={s.menuGroup}>
            <TouchableOpacity style={s.menuRow} onPress={() => setJoinModalVisible(true)}>
              <View style={[s.menuIcon, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="enter-outline" size={18} color={Colors.accentPurple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>{t('joinWallet')}</Text>
                <Text style={s.menuDesc}>{t('joinWalletDesc')}</Text>
              </View>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>

            {/* Pengingat Harian Toggle */}
            <View style={s.menuRow}>
              <View style={[s.menuIcon, { backgroundColor: Colors.savingsSoft }]}>
                <Ionicons name="notifications-outline" size={18} color={Colors.savings} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>{t('dailyReminder')}</Text>
                <Text style={s.menuDesc}>{t('dailyReminderDesc')}</Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={handleToggleReminder}
                trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                thumbColor={dailyReminder ? Colors.primary : Colors.textMuted}
              />
            </View>

            {/* Pilihan Bahasa (Language Selector) */}
            <View style={s.menuRow}>
              <View style={[s.menuIcon, { backgroundColor: Colors.primarySoft }]}>
                <Ionicons name="globe-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>{t('appLanguage')}</Text>
                <Text style={s.menuDesc}>
                  {language === 'id' ? 'Bahasa Indonesia aktif' : 'English active'}
                </Text>
              </View>
              <View style={s.langSegment}>
                <TouchableOpacity
                  style={[s.langBtn, language === 'id' && s.langBtnActive]}
                  onPress={() => setLanguage('id')}
                >
                  <Text style={[s.langBtnText, language === 'id' && s.langBtnTextActive]}>ID</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.langBtn, language === 'en' && s.langBtnActive]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[s.langBtnText, language === 'en' && s.langBtnTextActive]}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Periksa Pembaruan (OTA Updates) */}
            <View style={[s.menuRow, { borderBottomWidth: 0 }]}>
              <View style={[s.menuIcon, { backgroundColor: Colors.primarySoft }]}>
                <Ionicons name="cloud-download-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuTitle}>{t('checkUpdate')}</Text>
                <Text style={s.menuDesc}>{t('checkUpdateDesc')}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCheckUpdate}
                disabled={checkingUpdate}
                style={[s.updateBtn, checkingUpdate && { opacity: 0.6 }]}
              >
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={s.updateBtnText}>{t('checkUpdateBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>

          </Animated.View>

          {/* KELUAR AKUN */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)} style={{ marginTop: 20 }}>
            <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={18} color={Colors.expense} style={{ marginRight: 6 }} />
              <Text style={s.signOutBtnText}>{t('logOut')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* ── MODAL 1: EDIT PROFILE DISPLAY NAME ── */}
      <SwipeableModal
        visible={editProfileModalVisible}
        onClose={() => setEditProfileModalVisible(false)}
      >
        <Text style={s.sheetTitle}>{t('editProfileTitle')}</Text>
        <Text style={s.sheetSubtitle}>{t('editProfileSubtitle')}</Text>

        <TextInput
          style={s.sheetInput}
          value={profileNameInput}
          onChangeText={setProfileNameInput}
          placeholder={t('placeholderProfileName')}
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        <TouchableOpacity
          style={[s.sheetBtn, { marginTop: 16 }, savingProfileName && { opacity: 0.6 }]}
          onPress={handleSaveProfileName}
          disabled={savingProfileName}
        >
          {savingProfileName ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sheetBtnText}>{t('saveNameBtn')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={[s.cancelBtn, { marginTop: 8 }]}>
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      {/* ── MODAL 2: SWITCH WORKSPACE ── */}
      <SwipeableModal
        visible={switchWsModalVisible}
        onClose={() => setSwitchWsModalVisible(false)}
      >
        <Text style={s.sheetTitle}>{t('selectWallet')}</Text>
        <Text style={s.sheetSubtitle}>{t('selectWalletSubtitle')}</Text>

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
                {ws.image_url ? (
                  <Image source={{ uri: ws.image_url }} style={s.wsPickerImg} />
                ) : (
                  <View style={s.wsPickerImgPlaceholder}>
                    <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.wsPickerName, isActive && { color: Colors.primary, fontWeight: '800' }]}>
                    {ws.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons
                      name={ws.role === 'admin' ? 'ribbon-outline' : 'person-outline'}
                      size={12}
                      color={ws.role === 'admin' ? Colors.savings : Colors.textMuted}
                    />
                    <Text style={s.wsPickerRole}>
                      {ws.role === 'admin' ? t('roleOwner') : t('roleMember')}
                    </Text>
                  </View>
                </View>
                {isActive && <Text style={{ color: Colors.primary, fontWeight: '800', fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity onPress={() => setSwitchWsModalVisible(false)} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>{t('close')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      {/* ── MODAL 3: EDIT WORKSPACE NAME ── */}
      <SwipeableModal
        visible={editWsModalVisible}
        onClose={() => setEditWsModalVisible(false)}
      >
        <Text style={s.sheetTitle}>{t('renameWalletTitle')}</Text>

        <TextInput
          style={s.sheetInput}
          value={editWsName}
          onChangeText={setEditWsName}
          placeholder={t('placeholderWalletName')}
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        <TouchableOpacity
          style={[s.sheetBtn, { marginTop: 16 }, savingWsEdit && { opacity: 0.6 }]}
          onPress={handleSaveWsEdit}
          disabled={savingWsEdit}
        >
          {savingWsEdit ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sheetBtnText}>{t('saveChangesBtn')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setEditWsModalVisible(false)} style={[s.cancelBtn, { marginTop: 8 }]}>
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      {/* ── MODAL 4: GABUNG WORKSPACE ── */}
      <SwipeableModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
      >
        <Text style={s.sheetTitle}>{t('joinWalletTitle')}</Text>
        <Text style={s.sheetSubtitle}>{t('joinWalletSubtitle')}</Text>

        <TextInput
          style={s.sheetInput}
          value={joinInput}
          onChangeText={setJoinInput}
          placeholder={t('placeholderJoinWallet')}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity style={[s.sheetBtn, { marginTop: 16 }]} onPress={handleJoinWithInput}>
          <Text style={s.sheetBtnText}>{t('joinWalletBtn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={[s.cancelBtn, { marginTop: 8 }]}>
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      {/* ── MODAL 5: KICK MEMBER CONFIRMATION WITH REASON ── */}
      <SwipeableModal
        visible={kickModalVisible}
        onClose={() => setKickModalVisible(false)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 22 }}>⚠️</Text>
          <Text style={s.sheetTitle}>{t('kickMemberTitle')}</Text>
        </View>

        <Text style={s.sheetSubtitle}>
          {language === 'id' ? 'Apakah kamu yakin ingin mengeluarkan ' : 'Are you sure you want to remove '}
          <Text style={{ fontWeight: '700', color: Colors.textDark }}>
            {memberToKick?.display_name || memberToKick?.email || (language === 'id' ? 'anggota ini' : 'this member')}
          </Text>{' '}
          {language === 'id' ? `dari dompet "${activeWorkspace?.name}"?` : `from wallet "${activeWorkspace?.name}"?`}
        </Text>

        <View style={{ marginTop: 12, marginBottom: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textDark, marginBottom: 6 }}>
            {t('kickReasonLabel')}
          </Text>
          <TextInput
            style={[s.sheetInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            value={kickReason}
            onChangeText={setKickReason}
            placeholder={t('kickReasonPlaceholder')}
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
            <Text style={s.sheetBtnText}>{t('kickConfirmBtn')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setKickModalVisible(false)}
          style={s.cancelBtn}
          disabled={kicking}
        >
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      {/* ── MODAL: OTA Update Status ── */}
      <SwipeableModal
        visible={updatePhase !== 'idle'}
        onClose={() => { setUpdatePhase('idle'); setUpdateResult(null); }}
      >
        {/* Checking / Downloading phase */}
        {(updatePhase === 'checking' || updatePhase === 'downloading') && (
          <View style={s.updateModalBody}>
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
            <Text style={s.updateModalTitle}>
              {updatePhase === 'downloading' ? t('otaDownloading') : t('otaChecking')}
            </Text>
            <Text style={s.updateModalSub}>
              {updatePhase === 'downloading'
                ? t('otaDownloadingBody')
                : t('otaCheckingBody')}
            </Text>
          </View>
        )}

        {/* Done phase */}
        {updatePhase === 'done' && updateResult && (() => {
          const cfg = {
            updated:       { icon: '🚀' as const, color: Colors.income,   title: t('otaTitleUpdated'),        bg: Colors.incomeSoft },
            no_update:     { icon: '✅' as const, color: Colors.income,   title: t('otaTitleNoUpdate'),     bg: Colors.incomeSoft },
            not_supported: { icon: 'ℹ️' as const, color: Colors.accentBlue, title: t('otaTitleInfo'),                  bg: Colors.accentBlueSoft },
            error:         { icon: '⚠️' as const, color: Colors.expense,  title: t('otaTitleError'),  bg: Colors.expenseSoft },
          }[updateResult.status] ?? { icon: 'ℹ️' as const, color: Colors.primary, title: 'Update', bg: Colors.primarySoft };

          return (
            <View style={s.updateModalBody}>
              <View style={[s.updateModalIconWrap, { backgroundColor: cfg.bg }]}>
                <Text style={{ fontSize: 36 }}>{cfg.icon}</Text>
              </View>
              <Text style={[s.updateModalTitle, { color: cfg.color }]}>{cfg.title}</Text>
              <Text style={s.updateModalSub}>{updateResult.message}</Text>
              {/* Info versi saat ini */}
              {updateInfo.runtimeVersion && (
                <View style={s.updateVersionRow}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                  <Text style={s.updateVersionText}>
                    Runtime v{updateInfo.runtimeVersion}
                    {updateInfo.channel ? ` • channel: ${updateInfo.channel}` : ''}
                    {updateInfo.isEmbedded ? ' • embedded' : ''}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={s.updateModalCloseBtn}
                onPress={() => { setUpdatePhase('idle'); setUpdateResult(null); }}
              >
                <Text style={s.updateModalCloseBtnText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </SwipeableModal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primaryDark,
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
    borderRadius: Radius.xl,
    padding: 18,
    gap: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderBottomWidth: 3,
    borderBottomColor: Colors.borderDark,
    ...Shadows.clayCard,
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
  userAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  memberAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  updateBtn: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center' as const,
  },
  updateBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  langSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
  },
  langBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  langBtnTextActive: {
    color: '#fff',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  wsPickerImg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
  },
  wsPickerImgPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── OTA Update Modal ──
  updateModalBody: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  updateModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  updateModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  updateModalSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  updateVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
  },
  updateVersionText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  updateModalCloseBtn: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 36,
    ...Shadows.clayButton,
  },
  updateModalCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
