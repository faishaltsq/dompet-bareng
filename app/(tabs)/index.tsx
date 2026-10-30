import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  Image,
  Vibration,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace, Transaction, Workspace } from '@/context/WorkspaceContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import NotificationModal from '@/components/NotificationModal';
import SwipeableModal from '@/components/SwipeableModal';
import { formatRupiah, getCategoryMeta } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { HomeSkeleton } from '@/components/Skeleton';
import { PressableScale, AnimatedProgressBar } from '@/components/Animated';
import { triggerDownloadApk } from '@/lib/downloadApp';
import OtterMascot from '@/components/OtterMascot';
import EmptyState from '@/components/EmptyState';

type PeriodFilter = 'all' | 'month' | 'week' | 'day';

function CreateWorkspaceModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    await onCreate(name.trim());
    setCreating(false);
    setName('');
  };

  return (
    <SwipeableModal visible={visible} onClose={() => { setName(''); onClose(); }}>
      <Text style={s.sheetTitle}>{t('createNewWallet')}</Text>
      <Text style={[s.sheetSubtitle, { marginBottom: 16 }]}>{t('createWalletSubtitle')}</Text>

      <TextInput
        style={s.sheetInput}
        placeholder={t('walletNamePlaceholder')}
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleCreate}
      />

      <TouchableOpacity
        style={[s.sheetBtn, { marginTop: 16 }, creating && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={s.sheetBtnText}>{t('createWalletBtn')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={[s.cancelBtn, { marginTop: 8 }]}>
        <Text style={s.cancelBtnText}>{t('cancel')}</Text>
      </TouchableOpacity>
    </SwipeableModal>
  );
}

export default function HomeScreen() {
  const { user, profile, avatarUrl } = useAuth();
  const { unreadCount } = useNotifications();
  const { t, language } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    transactions,
    loadingWorkspaces,
    loadingTx,
    setActiveWorkspace,
    createWorkspace,
    deleteTransaction,
    summary,
    hasMoreTx,
    loadMoreTransactions,
    refetchTransactions,
  } = useWorkspace();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const [showCreate, setShowCreate] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('month');

  const googleAvatarUrl = avatarUrl;
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('userFallback');
  const userInitial = (displayName[0] || 'U').toUpperCase();

  const handleCreate = useCallback(async (name: string) => {
    const ws = await createWorkspace(name);
    if (ws) setShowCreate(false);
    else Alert.alert(t('alertFailed'), t('alertCreateWalletFailed'));
  }, [createWorkspace]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchTransactions();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    const doDelete = async () => {
      Vibration.vibrate([0, 80, 60, 120]);
      const ok = await deleteTransaction(id);
      if (!ok) {
        Alert.alert(t('alertFailed'), t('deleteTransactionFailed'));
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('deleteTransactionConfirm'));
      if (confirmed) {
        doDelete();
      }
      return;
    }

    Alert.alert(t('deleteTransactionBtn'), t('deleteTransactionConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: doDelete,
      },
    ]);
  };

  // Filter transaksi berdasarkan periode
  const filteredTransactions = useMemo(() => {
    if (!activeWorkspace) return [];
    // Pastikan hanya transaksi milik activeWorkspace yang ditampilkan
    const wsTransactions = transactions.filter(t => t.workspace_id === activeWorkspace.id);
    if (period === 'all') return wsTransactions;
    const now = new Date();
    return wsTransactions.filter(t => {
      // Parse as local midnight to avoid UTC boundary shifts
      const d = new Date(t.transaction_date + 'T00:00:00');
      if (period === 'day') {
        return d.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (period === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [transactions, period, activeWorkspace]);

  // Budget persentase pengeluaran vs pemasukan
  const budgetPercent = summary.income > 0
    ? Math.min(Math.round((summary.expense / summary.income) * 100), 100)
    : summary.expense > 0 ? 100 : 0;

  if (loadingWorkspaces && workspaces.length === 0) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <HomeSkeleton />
      </View>
    );
  }

  // Tampilan ketika belum ada workspace
  if (!activeWorkspace && workspaces.length === 0) {
    return (
      <View style={[s.root, s.emptyCenter, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Animated.View entering={FadeInUp.springify()} style={s.emptyBox}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="wallet-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={s.emptyTitle}>{t('getStartedTitle')}</Text>
          <Text style={s.emptySubtitle}>
            {t('getStartedSubtitle')}
          </Text>
          <PressableScale onPress={() => setShowCreate(true)} style={s.emptyBtn}>
            <Text style={s.emptyBtnText}>＋ {t('createWalletNow')}</Text>
          </PressableScale>
        </Animated.View>
        <CreateWorkspaceModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      </View>
    );
  }

  // FinWise Header + Dashboard Cards
  const ListHeader = (
    <View style={s.headerContainer}>
      {/* 1. TOP BAR (FinWise Mint Header) */}
      <View style={[s.finTopBar, { paddingTop: insets.top + 10 }]}>
        <View style={s.greetingRow}>
          <TouchableOpacity
            style={s.userAvatar}
            onPress={() => router.push('/(tabs)/two')}
            activeOpacity={0.8}
          >
            {googleAvatarUrl ? (
              <Image
                source={{ uri: googleAvatarUrl }}
                style={s.avatarImg}
                // @ts-ignore
                referrerPolicy="no-referrer"
              />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>{userInitial}</Text>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.greetingSub}>{t('hiWelcome')}</Text>
            <Text style={s.greetingName} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          {/* DOWNLOAD ANDROID APP BUTTON (Web only) */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={s.downloadPillBtn}
              onPress={() => triggerDownloadApk()}
              activeOpacity={0.8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('downloadAndroidApp')}
            >
              <Ionicons name="logo-android" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={s.downloadPillText}>{t('downloadApkBtn')}</Text>
            </TouchableOpacity>
          )}

          {/* NOTIFICATION BUTTON */}
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => setShowNotifModal(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. BODY SHEET WITH ROUNDED CORNERS */}
      <View style={s.sheetBody}>
        {/* HERO BALANCE CARD (Modern Fintech Card with Otter Mascot) */}
        <Animated.View entering={FadeInDown.duration(450)} style={s.heroCard}>
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="wallet" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={s.heroLabel}>{t('totalBalance')}</Text>
                {activeWorkspace?.name ? (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }} numberOfLines={1}>
                    • {activeWorkspace.name}
                  </Text>
                ) : null}
              </View>
              <Text style={s.heroAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatRupiah(summary.balance)}</Text>
            </View>
            <View style={s.heroMascotWrap}>
              <OtterMascot
                variant={summary.balance >= 0 ? 'rich' : 'panic'}
                size="md"
              />
            </View>
          </View>

          {/* Mini Two-Column Metrics — separate mini-cards */}
          <View style={s.metricsRow}>
            <View style={[s.metricItem, s.metricIncome]}>
              <View style={s.metricHeader}>
                <Ionicons name="arrow-up-circle" size={16} color="#34D399" />
                <Text style={[s.metricLabel, { color: '#E6FFFA' }]}>{t('income')}</Text>
              </View>
              <Text style={[s.metricValue, { color: '#6EE7B7' }]}>
                {formatRupiah(summary.income)}
              </Text>
            </View>
            <View style={[s.metricItem, s.metricExpense]}>
              <View style={s.metricHeader}>
                <Ionicons name="arrow-down-circle" size={16} color="#F87171" />
                <Text style={[s.metricLabel, { color: '#FFE4E6' }]}>{t('expense')}</Text>
              </View>
              <Text style={[s.metricValue, { color: '#FCA5A5' }]}>
                {formatRupiah(summary.expense)}
              </Text>
            </View>
          </View>

          {/* Budget Progress Bar */}
          <View style={s.budgetSection}>
            <View style={s.budgetHeader}>
              <Text style={s.budgetTitle}>{t('budgetUsed')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.budgetPercent, { color: budgetPercent <= 50 ? '#34D399' : budgetPercent <= 80 ? '#FBBF24' : '#F87171' }]}>{budgetPercent}%</Text>
                <View style={[s.budgetBadge, { backgroundColor: budgetPercent <= 50 ? 'rgba(16,185,129,0.25)' : budgetPercent <= 80 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)' }]}>
                  <Text style={[s.budgetBadgeText, { color: budgetPercent <= 50 ? '#34D399' : budgetPercent <= 80 ? '#FBBF24' : '#F87171' }]}>
                    {budgetPercent <= 50 ? t('budgetHealthy') : budgetPercent <= 80 ? t('budgetWarning') : t('budgetCritical')}
                  </Text>
                </View>
              </View>
            </View>
            <AnimatedProgressBar
              progress={budgetPercent}
              color={budgetPercent <= 50 ? '#34D399' : budgetPercent <= 80 ? '#FBBF24' : '#F87171'}
              trackColor="rgba(255,255,255,0.15)"
              height={8}
            />
          </View>
        </Animated.View>

        {/* QUICK ACTIONS ROW */}
        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={s.quickActionsRow}>
          <TouchableOpacity
            style={s.quickActionBtn}
            onPress={() => router.push('/modal')}
          >
            <View style={[s.quickActionIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="add" size={24} color={Colors.primary} />
            </View>
            <Text style={s.quickActionLabel}>{t('recordBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.quickActionBtn}
            onPress={() => setShowSwitchModal(true)}
          >
            <View style={[s.quickActionIcon, { backgroundColor: Colors.accentBlueSoft }]}>
              <Ionicons name="swap-horizontal" size={22} color={Colors.accentBlue} />
            </View>
            <Text style={s.quickActionLabel}>{t('switchWallet')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.quickActionBtn}
            onPress={() => router.push('/(tabs)/statistics')}
          >
            <View style={[s.quickActionIcon, { backgroundColor: Colors.accentPurpleSoft }]}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.accentPurple} />
            </View>
            <Text style={s.quickActionLabel}>{t('statisticsTab')}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* PERIOD FILTER (FinWise Segmented Control) */}
        <Animated.View entering={FadeInDown.delay(150).duration(450)} style={s.periodSegment}>
          {(['month', 'week', 'day', 'all'] as PeriodFilter[]).map(p => {
            const labels: Record<PeriodFilter, string> = {
              month: t('thisMonth'),
              week: t('thisWeek'),
              day: t('today'),
              all: t('allTime'),
            };
            const active = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[s.periodPill, active && s.periodPillActive]}
                onPress={() => setPeriod(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.periodPillText, active && s.periodPillTextActive]}>
                  {labels[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* SECTION TITLE */}
        <View style={s.txSectionHeader}>
          <Text style={s.txSectionTitle}>{t('recentTx')}</Text>
          <Text style={s.txSectionCount}>
            {filteredTransactions.length} {t('txCount')}
          </Text>
        </View>

        {loadingTx && transactions.length === 0 && (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        )}
      </View>
    </View>
  );

  const modals = (
    <>
      <SwipeableModal
        visible={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
      >
        <Text style={s.sheetTitle}>{t('selectWallet')}</Text>
        <Text style={s.sheetSubtitle}>{t('selectWalletSubtitle')}</Text>

        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
          {workspaces.map(ws => {
            const isActive = ws.id === activeWorkspace?.id;
            return (
              <TouchableOpacity
                key={ws.id}
                style={[s.wsRow, isActive && s.wsRowActive]}
                onPress={() => {
                  setActiveWorkspace(ws);
                  setShowSwitchModal(false);
                }}
              >
                {ws.image_url ? (
                  <Image source={{ uri: ws.image_url }} style={s.wsRowImg} />
                ) : (
                  <View style={s.wsRowImgPlaceholder}>
                    <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.wsRowName, isActive && { color: Colors.primary, fontWeight: '800' }]}>
                    {ws.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons
                      name={ws.role === 'admin' ? 'ribbon-outline' : 'person-outline'}
                      size={12}
                      color={ws.role === 'admin' ? Colors.savings : Colors.textMuted}
                    />
                    <Text style={s.wsRowRole}>
                      {ws.role === 'admin' ? t('roleOwner') : t('roleMember')}
                    </Text>
                  </View>
                </View>
                {isActive && (
                  <View style={s.activeBadge}>
                    <Text style={s.activeBadgeText}>{t('activeStatus')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.modalActionsRow}>
          <TouchableOpacity
            style={s.modalActionBtn}
            onPress={() => {
              setShowSwitchModal(false);
              setShowCreate(true);
            }}
          >
            <Text style={s.modalActionBtnText}>＋ {t('newWallet')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modalActionBtn, s.modalActionBtnOutline]}
            onPress={() => {
              setShowSwitchModal(false);
              router.push('/(tabs)/two');
            }}
          >
            <Text style={s.modalActionBtnTextOutline}>📥 {t('joinOther')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setShowSwitchModal(false)} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>{t('close')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      <CreateWorkspaceModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      <NotificationModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
      />
    </>
  );

  if (isLargeScreen) {
    return (
      <View style={s.desktopContainer}>
        <StatusBar style="dark" />

        {/* 1. DESKTOP/TABLET TOP HEADER */}
        <View style={[s.desktopHeader, isTablet && s.desktopHeaderTablet]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[s.desktopGreetingTitle, isTablet && s.desktopGreetingTitleTablet]} numberOfLines={1}>
              Halo, {displayName} 👋
            </Text>
            {!isTablet && (
              <Text style={s.desktopGreetingSub}>
                Kelola keuangan rumah tanggamu bersama-sama dengan mudah
              </Text>
            )}
          </View>

          <View style={s.desktopHeaderActions}>
            {/* Workspace Selector Pill */}
            <TouchableOpacity
              style={[s.desktopPill, isTablet && s.desktopPillTablet]}
              onPress={() => setShowSwitchModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="home" size={isTablet ? 13 : 16} color={Colors.forestGreen} />
              <Text style={[s.desktopPillText, isTablet && s.desktopPillTextTablet]} numberOfLines={1}>
                {activeWorkspace?.name || 'Pilih Dompet'}
              </Text>
              <Ionicons name="chevron-down" size={isTablet ? 12 : 14} color="#64748B" />
            </TouchableOpacity>

            {/* Period Selector Pills */}
            <View style={[s.desktopPeriodPills, isTablet && s.desktopPeriodPillsTablet]}>
              {(['month', 'week', 'day', 'all'] as PeriodFilter[]).map((p) => {
                const labels: Record<PeriodFilter, string> = {
                  month: t('thisMonth'),
                  week: t('thisWeek'),
                  day: t('today'),
                  all: t('allTime'),
                };
                const active = period === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      s.desktopPeriodPill,
                      isTablet && s.desktopPeriodPillTablet,
                      active && s.desktopPeriodPillActive,
                    ]}
                    onPress={() => setPeriod(p)}
                  >
                    <Text
                      style={[
                        s.desktopPeriodPillText,
                        isTablet && s.desktopPeriodPillTextTablet,
                        active && s.desktopPeriodPillTextActive,
                      ]}
                    >
                      {labels[p]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notification */}
            <TouchableOpacity
              style={[s.desktopNotifBtn, isTablet && { width: 36, height: 36 }]}
              onPress={() => setShowNotifModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={isTablet ? 18 : 20} color="#0F3832" />
              {unreadCount > 0 && (
                <View style={s.notifBadge}>
                  <Text style={s.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Avatar */}
            <TouchableOpacity
              style={[s.desktopAvatar, isTablet && { width: 36, height: 36 }]}
              onPress={() => router.push('/(tabs)/two')}
              activeOpacity={0.8}
            >
              {googleAvatarUrl ? (
                <Image source={{ uri: googleAvatarUrl }} style={s.avatarImg} />
              ) : (
                <Text style={{ fontSize: isTablet ? 14 : 16, fontWeight: '800', color: '#FFFFFF' }}>{userInitial}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. DESKTOP/TABLET MAIN SCROLL AREA */}
        <ScrollView
          style={s.desktopScroll}
          contentContainerStyle={[s.desktopScrollContent, isTablet && s.desktopScrollContentTablet]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {/* ROW 1: 3 KPI CARDS */}
          <View style={[s.desktopKpiRow, isTablet && s.desktopKpiRowTablet]}>
            {/* CARD 1: TOTAL SALDO */}
            <View style={[s.desktopKpiCardPrimary, isTablet && s.desktopKpiCardTablet]}>
              <View style={s.desktopKpiTop}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="wallet" size={isTablet ? 14 : 16} color="rgba(255,255,255,0.85)" />
                    <Text style={[s.desktopKpiLabelLight, isTablet && { fontSize: 11 }]}>{t('totalBalance')}</Text>
                  </View>
                  <Text style={[s.desktopKpiSubLight, isTablet && { fontSize: 10 }]}>• {activeWorkspace?.name || 'Utama'}</Text>
                </View>
                <View style={[s.desktopOtterWrap, isTablet && { width: 36, height: 36 }]}>
                  <OtterMascot variant={summary.balance >= 0 ? 'rich' : 'panic'} size={isTablet ? 32 : 'sm'} />
                </View>
              </View>

              <Text
                style={[s.desktopKpiAmountLight, isTablet && s.desktopKpiAmountLightTablet]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatRupiah(summary.balance)}
              </Text>

              <View style={s.desktopKpiBottom}>
                <View style={[s.desktopBadgeGreen, isTablet && { paddingVertical: 2, paddingHorizontal: 6 }]}>
                  <Ionicons name="trending-up" size={isTablet ? 10 : 12} color="#00A86B" />
                  <Text style={[s.desktopBadgeGreenText, isTablet && { fontSize: 10 }]}>
                    {summary.income >= summary.expense ? '+Surplus Sehat' : 'Defisit Pengeluaran'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.desktopRecordBtn, isTablet && s.desktopRecordBtnTablet]}
                  onPress={() => router.push('/modal')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={isTablet ? 14 : 16} color="#0F3832" />
                  <Text style={[s.desktopRecordBtnText, isTablet && s.desktopRecordBtnTextTablet]}>{t('recordBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* CARD 2: PEMASUKAN */}
            <View style={[s.desktopKpiCard, isTablet && s.desktopKpiCardTablet]}>
              <View style={s.desktopKpiHeaderRow}>
                <View style={[s.desktopKpiIconCircle, isTablet && { width: 30, height: 30 }, { backgroundColor: '#E8F8F5' }]}>
                  <Ionicons name="arrow-up" size={isTablet ? 15 : 18} color="#00A86B" />
                </View>
                <Text style={[s.desktopKpiLabel, isTablet && { fontSize: 12 }]}>{t('income')}</Text>
              </View>
              <Text
                style={[s.desktopKpiAmount, isTablet && s.desktopKpiAmountTablet, { color: Colors.income }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatRupiah(summary.income)}
              </Text>
              <Text style={[s.desktopKpiFootnote, isTablet && s.desktopKpiFootnoteTablet]} numberOfLines={1}>
                Total pemasukan tercatat periode ini
              </Text>
            </View>

            {/* CARD 3: PENGELUARAN */}
            <View style={[s.desktopKpiCard, isTablet && s.desktopKpiCardTablet]}>
              <View style={s.desktopKpiHeaderRow}>
                <View style={[s.desktopKpiIconCircle, isTablet && { width: 30, height: 30 }, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="arrow-down" size={isTablet ? 15 : 18} color="#FA5A5A" />
                </View>
                <Text style={[s.desktopKpiLabel, isTablet && { fontSize: 12 }]}>{t('expense')}</Text>
              </View>
              <Text
                style={[s.desktopKpiAmount, isTablet && s.desktopKpiAmountTablet, { color: Colors.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatRupiah(summary.expense)}
              </Text>
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: isTablet ? 10 : 11, color: '#64748B', fontWeight: '600' }}>Pemakaian Budget</Text>
                  <Text style={{ fontSize: isTablet ? 10 : 11, color: budgetPercent > 90 ? '#FA5A5A' : '#00A86B', fontWeight: '800' }}>
                    {budgetPercent}%
                  </Text>
                </View>
                <AnimatedProgressBar
                  progress={budgetPercent / 100}
                  color={budgetPercent > 90 ? Colors.coralExpense : budgetPercent > 75 ? Colors.accentOrange : Colors.mintGreen}
                  height={isTablet ? 5 : 6}
                />
              </View>
            </View>
          </View>

          {/* ROW 2: TWO-COLUMN CONTENT GRID */}
          <View style={[s.desktopContentGrid, isTablet && s.desktopContentGridTablet]}>
            {/* LEFT COLUMN: TRANSAKSI TERBARU */}
            <View style={[s.desktopLeftCol, isTablet && s.desktopLeftColTablet]}>
              <View style={s.desktopSectionHeader}>
                <View>
                  <Text style={s.desktopSectionTitle}>{t('recentTx')}</Text>
                  <Text style={s.desktopSectionCount}>
                    {filteredTransactions.length} {t('txCount')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.desktopAddTxBtn}
                  onPress={() => router.push('/modal')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={s.desktopAddTxBtnText}>+ Transaksi</Text>
                </TouchableOpacity>
              </View>

              {filteredTransactions.length === 0 ? (
                <EmptyState
                  mascot="sleeping"
                  title={t('emptyTxTitle')}
                  subtitle={t('emptyTxDesc')}
                  actionLabel={`+ ${t('recordBtn')}`}
                  onAction={() => router.push('/modal')}
                />
              ) : (
                <View style={s.desktopTxList}>
                  {filteredTransactions.map((item) => {
                    const meta = getCategoryMeta(item.category);
                    const isIncome = item.type === 'income';
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={s.txItem}
                        onPress={() => router.push(`/transaction/${item.id}` as any)}
                        onLongPress={() => handleDelete(item.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.txIconCircle, { backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon || 'receipt-outline'} size={20} color={meta.color} />
                        </View>
                        <View style={s.txDetails}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={s.txTitle}>{item.category}</Text>
                            {item.updated_at && item.updated_at !== item.created_at && (
                              <View style={s.editedTag}>
                                <Text style={s.editedTagText}>{t('editedTag')}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={s.txSubtitle} numberOfLines={1}>
                            {item.description || item.transaction_date}
                          </Text>
                          {item.user_display_name || item.user_email ? (
                            <Text style={s.txAuthor} numberOfLines={1}>
                              {t('byAuthor')} {item.user_display_name || item.user_email?.split('@')[0]}
                            </Text>
                          ) : null}
                        </View>
                        <View style={s.txAmountCol}>
                          <Text style={[s.txAmountText, { color: isIncome ? Colors.income : Colors.expense }]}>
                            {isIncome ? '+' : '-'}{formatRupiah(item.amount)}
                          </Text>
                          <Text style={s.txDateText}>{item.transaction_date}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* RIGHT COLUMN: RINGKASAN DOMPET & ANGGARAN & OTTER */}
            <View style={[s.desktopRightCol, isTablet && s.desktopRightColTablet]}>
              {/* CARD 1: RINGKASAN DOMPET */}
              <View style={s.desktopSideCard}>
                <View style={s.desktopSideCardHeader}>
                  <Ionicons name="home-outline" size={18} color="#0F3832" />
                  <Text style={s.desktopSideCardTitle}>Dompet Keluarga</Text>
                </View>
                <Text style={s.desktopWsName}>{activeWorkspace?.name || 'Dompet Bareng'}</Text>
                <Text style={s.desktopWsRole}>
                  Peran: {activeWorkspace?.role === 'admin' ? 'Pemilik (Admin)' : 'Anggota'}
                </Text>
                <View style={s.desktopWsActions}>
                  <TouchableOpacity
                    style={s.desktopOutlineBtn}
                    onPress={() => setShowSwitchModal(true)}
                  >
                    <Ionicons name="swap-horizontal" size={14} color="#0F3832" />
                    <Text style={s.desktopOutlineBtnText}>Ganti Dompet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.desktopOutlineBtn}
                    onPress={() => router.push('/(tabs)/two')}
                  >
                    <Ionicons name="people-outline" size={14} color="#0F3832" />
                    <Text style={s.desktopOutlineBtnText}>Kelola Anggota</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* CARD 2: PROGRES ANGGARAN */}
              <View style={s.desktopSideCard}>
                <View style={s.desktopSideCardHeader}>
                  <Ionicons name="pie-chart-outline" size={18} color="#0F3832" />
                  <Text style={s.desktopSideCardTitle}>Progres Anggaran</Text>
                </View>
                <View style={{ marginVertical: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>
                      Status: {budgetPercent > 90 ? 'Perhatian!' : budgetPercent > 70 ? 'Waspada' : 'Aman'}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: budgetPercent > 90 ? '#FA5A5A' : '#00A86B' }}>
                      {budgetPercent}%
                    </Text>
                  </View>
                  <AnimatedProgressBar
                    progress={budgetPercent / 100}
                    color={budgetPercent > 90 ? Colors.coralExpense : budgetPercent > 75 ? Colors.accentOrange : Colors.mintGreen}
                    height={8}
                  />
                </View>
                <Text style={s.desktopBudgetNote}>
                  {budgetPercent > 90
                    ? 'Pengeluaran mendekati pemasukan. Tinjau kembali pos anggaran belanja.'
                    : 'Pengeluaran masih dalam batas aman. Pertahankan pola hemat keluarga!'}
                </Text>
              </View>

              {/* CARD 3: INSIGHT KEUANGAN BERSAMA OTTER */}
              <View style={s.desktopOtterCard}>
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                  <OtterMascot
                    variant={budgetPercent > 90 ? 'panic' : summary.balance > 0 ? 'rich' : 'happy'}
                    size="md"
                  />
                </View>
                <Text style={s.desktopOtterTitle}>Catatan Sahabat Otter</Text>
                <Text style={s.desktopOtterText}>
                  "Keuangan yang tercatat rapi membawa ketenangan dalam rumah tangga. Jangan lupa cek statistik berkala!"
                </Text>
                <TouchableOpacity
                  style={s.desktopOtterBtn}
                  onPress={() => router.push('/(tabs)/statistics')}
                  activeOpacity={0.8}
                >
                  <Text style={s.desktopOtterBtnText}>Lihat Analisis Lengkap →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {modals}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <FlatList
        data={filteredTransactions}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: 40 }}
        onEndReached={() => { if (hasMoreTx) loadMoreTransactions(); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={hasMoreTx ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
        ) : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item, index }) => {
          const meta = getCategoryMeta(item.category);
          const isIncome = item.type === 'income';

          return (
            <Animated.View entering={FadeInUp.delay(Math.min(index, 10) * 35).duration(300)}>
              <TouchableOpacity
                style={s.txItem}
                onPress={() => router.push(`/transaction/${item.id}` as any)}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.8}
                accessible={true}
                accessibilityLabel={`${item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}, ${item.category}, ${formatRupiah(item.amount)}`}
                accessibilityHint="Tekan lama untuk menghapus"
              >
                <View style={[s.txIconCircle, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon || 'receipt-outline'} size={20} color={meta.color} />
                </View>

                <View style={s.txDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.txTitle}>{item.category}</Text>
                    {item.updated_at && item.updated_at !== item.created_at && (
                      <View style={s.editedTag}>
                        <Text style={s.editedTagText}>{t('editedTag')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.txSubtitle} numberOfLines={1}>
                    {item.description || item.transaction_date}
                  </Text>
                  {item.user_display_name || item.user_email ? (
                    <Text style={s.txAuthor} numberOfLines={1}>
                      {t('byAuthor')} {item.user_display_name || item.user_email?.split('@')[0]}
                    </Text>
                  ) : null}
                </View>

                <View style={s.txAmountCol}>
                  <Text style={[s.txAmountText, { color: isIncome ? Colors.income : Colors.expense }]}>
                    {isIncome ? '+' : '-'}{formatRupiah(item.amount)}
                  </Text>
                  <Text style={s.txDateText}>{item.transaction_date}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          !loadingTx ? (
            <EmptyState
              mascot="sleeping"
              title={t('emptyTxTitle')}
              subtitle={t('emptyTxDesc')}
              actionLabel={t('recordBtn')}
              onAction={() => router.push('/modal')}
              compact
            />
          ) : null
        }
      />

      {modals}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },

  // 1. Top Bar
  headerContainer: {
    backgroundColor: Colors.forestGreen,
  },
  finTopBar: {
    backgroundColor: Colors.forestGreen,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  downloadPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  downloadPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  greetingSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  greetingName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },

  // ── Switch Workspace Modal Styles ──
  wsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  wsRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  wsRowImg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
  },
  wsRowImgPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wsRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  wsRowRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  activeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalActionBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalActionBtnOutline: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  modalActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalActionBtnTextOutline: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // 2. Sheet Body
  sheetBody: {
    backgroundColor: '#F7FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.forestGreen,
    borderRadius: Radius.xl,
    padding: 22,
    gap: 16,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMascotWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  metricIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(110, 231, 183, 0.6)',
  },
  metricExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(252, 165, 165, 0.6)',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Budget
  budgetSection: {
    gap: 8,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  budgetPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryLight,
  },
  budgetBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  budgetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
  },

  // Segmented Control
  periodSegment: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    borderRadius: Radius.full,
    padding: 4,
    marginTop: 20,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  periodPillActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  periodPillTextActive: {
    color: Colors.forestGreen,
    fontWeight: '700',
  },

  // Transactions section header
  txSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
  },
  txSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  txSectionCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Transaction item
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    ...Shadows.card,
  },
  txIconCircle: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
    gap: 3,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  editedTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  editedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  txSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  txAuthor: {
    fontSize: 11,
    color: Colors.accentTeal,
    fontWeight: '600',
    marginTop: 1,
  },
  txAmountCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  txAmountText: {
    fontSize: 14,
    fontWeight: '800',
  },
  txDateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Empty state
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDark,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
    ...Shadows.float,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Modals
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
    gap: 14,
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textDark,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: -6,
  },
  sheetInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: Colors.background,
    color: Colors.textDark,
  },
  sheetBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 15,
    alignItems: 'center',
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
  iconGlyph: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
  },

  // Desktop Web Styles
  desktopContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  desktopHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopGreetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F3832',
    letterSpacing: -0.3,
  },
  desktopGreetingSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  desktopHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  desktopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F8F5',
    borderWidth: 1,
    borderColor: '#C3EBE3',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  desktopPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3832',
    maxWidth: 160,
  },
  desktopPeriodPills: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    padding: 3,
    gap: 2,
  },
  desktopPeriodPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  desktopPeriodPillActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.card,
  },
  desktopPeriodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  desktopPeriodPillTextActive: {
    color: '#0F3832',
    fontWeight: '800',
  },
  desktopNotifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  desktopAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.forestGreen,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  desktopScroll: {
    flex: 1,
  },
  desktopScrollContent: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  desktopKpiRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 24,
  },
  desktopKpiCardPrimary: {
    flex: 1.25,
    backgroundColor: '#0F3832',
    borderRadius: Radius.xl,
    padding: 22,
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  desktopKpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  desktopKpiLabelLight: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  desktopKpiSubLight: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginTop: 2,
  },
  desktopOtterWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopKpiAmountLight: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginVertical: 14,
  },
  desktopKpiBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desktopBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,168,107,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  desktopBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27C93F',
  },
  desktopRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  desktopRecordBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F3832',
  },
  desktopKpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  desktopKpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  desktopKpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopKpiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  desktopKpiAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  desktopKpiFootnote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  desktopContentGrid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  desktopLeftCol: {
    flex: 1.55,
  },
  desktopSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  desktopSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F3832',
  },
  desktopSectionCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  desktopAddTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F3832',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  desktopAddTxBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  desktopTxList: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Shadows.card,
  },
  desktopRightCol: {
    flex: 1,
    gap: 18,
  },
  desktopSideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  desktopSideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  desktopSideCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F3832',
  },
  desktopWsName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F3832',
  },
  desktopWsRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  desktopWsActions: {
    flexDirection: 'row',
    gap: 10,
  },
  desktopOutlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
  },
  desktopOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F3832',
  },
  desktopBudgetNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  desktopOtterCard: {
    backgroundColor: '#E6F7F2',
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#BCECE0',
    alignItems: 'center',
    ...Shadows.card,
  },
  desktopOtterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F3832',
    marginBottom: 6,
    textAlign: 'center',
  },
  desktopOtterText: {
    fontSize: 12,
    color: '#2C5E55',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  desktopOtterBtn: {
    backgroundColor: '#0F3832',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
  },
  desktopOtterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Tablet Styles
  desktopHeaderTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  desktopGreetingTitleTablet: {
    fontSize: 18,
  },
  desktopPillTablet: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: 130,
  },
  desktopPillTextTablet: {
    fontSize: 12,
  },
  desktopPeriodPillsTablet: {
    gap: 2,
    padding: 3,
  },
  desktopPeriodPillTablet: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  desktopPeriodPillTextTablet: {
    fontSize: 11,
  },
  desktopScrollContentTablet: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  desktopKpiRowTablet: {
    gap: 10,
    marginBottom: 16,
  },
  desktopKpiCardTablet: {
    padding: 14,
    borderRadius: Radius.lg,
  },
  desktopKpiAmountLightTablet: {
    fontSize: 20,
    marginVertical: 4,
  },
  desktopKpiAmountTablet: {
    fontSize: 18,
    marginVertical: 4,
  },
  desktopKpiFootnoteTablet: {
    fontSize: 10,
  },
  desktopRecordBtnTablet: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  desktopRecordBtnTextTablet: {
    fontSize: 11,
  },
  desktopContentGridTablet: {
    gap: 16,
  },
  desktopLeftColTablet: {
    gap: 16,
  },
  desktopRightColTablet: {
    gap: 16,
  },
});
