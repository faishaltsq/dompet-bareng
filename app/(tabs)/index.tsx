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
  RefreshControl,
  Image,
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
    <SwipeableModal visible={visible} onClose={onClose}>
      <Text style={s.sheetTitle}>{t('createNewWallet')}</Text>
      <Text style={s.sheetSubtitle}>{t('createWalletSubtitle')}</Text>

      <TextInput
        style={s.sheetInput}
        placeholder="Misal: Kas Keluarga, Tabungan Liburan"
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <TouchableOpacity
        style={[s.sheetBtn, creating && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={s.sheetBtnText}>{t('createWalletBtn')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
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
    refetchTransactions,
  } = useWorkspace();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showCreate, setShowCreate] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('month');

  const googleAvatarUrl = avatarUrl;
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Pengguna';
  const userInitial = (displayName[0] || 'U').toUpperCase();

  const handleCreate = useCallback(async (name: string) => {
    const ws = await createWorkspace(name);
    if (ws) setShowCreate(false);
    else Alert.alert('Gagal', 'Tidak dapat membuat dompet. Coba lagi.');
  }, [createWorkspace]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchTransactions();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Hapus Transaksi', 'Tindakan ini tidak dapat dibatalkan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => deleteTransaction(id),
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
      const d = new Date(t.transaction_date);
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
              <Image source={{ uri: googleAvatarUrl }} style={s.avatarImg} />
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

          {/* NOTIFICATION BUTTON */}
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => setShowNotifModal(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        {/* HERO BALANCE CARD (FinWise Emerald Widget) */}
        <Animated.View entering={FadeInDown.duration(450)} style={s.heroCard}>
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.heroLabel}>{t('totalBalance')}</Text>
                {activeWorkspace?.name ? (
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }} numberOfLines={1}>
                    • {activeWorkspace.name}
                  </Text>
                ) : null}
              </View>
              <Text style={s.heroAmount}>{formatRupiah(summary.balance)}</Text>
            </View>
            <PressableScale
              style={s.heroActionPlus}
              onPress={() => router.push('/modal')}
            >
              <Text style={s.heroActionPlusText}>＋</Text>
            </PressableScale>
          </View>

          {/* Mini Two-Column Metrics */}
          <View style={s.metricsRow}>
            <View style={s.metricItem}>
              <View style={s.metricHeader}>
                <View style={[s.dotIndicator, { backgroundColor: Colors.income }]} />
                <Text style={s.metricLabel}>{t('income')}</Text>
              </View>
              <Text style={[s.metricValue, { color: Colors.income }]}>
                {formatRupiah(summary.income)}
              </Text>
            </View>
            <View style={s.metricDivider} />
            <View style={s.metricItem}>
              <View style={s.metricHeader}>
                <View style={[s.dotIndicator, { backgroundColor: Colors.expense }]} />
                <Text style={s.metricLabel}>{t('expense')}</Text>
              </View>
              <Text style={[s.metricValue, { color: Colors.expense }]}>
                {formatRupiah(summary.expense)}
              </Text>
            </View>
          </View>

          {/* Budget Progress Bar */}
          <View style={s.budgetSection}>
            <View style={s.budgetHeader}>
              <Text style={s.budgetTitle}>{t('budgetUsed')}</Text>
              <Text style={s.budgetPercent}>{budgetPercent}%</Text>
            </View>
            <AnimatedProgressBar
              progress={budgetPercent}
              color={budgetPercent > 80 ? Colors.expense : Colors.primary}
              trackColor="rgba(255,255,255,0.25)"
              height={7}
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

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <FlatList
        data={filteredTransactions}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: 40 }}
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
            <Animated.View entering={FadeInUp.delay(index * 35).duration(300)}>
              <TouchableOpacity
                style={s.txItem}
                onPress={() => router.push(`/transaction/${item.id}` as any)}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
              >
                <View style={[s.txIconCircle, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon || 'receipt-outline'} size={20} color={meta.color} />
                </View>

                <View style={s.txDetails}>
                  <Text style={s.txTitle}>{item.category}</Text>
                  <Text style={s.txSubtitle} numberOfLines={1}>
                    {item.description || item.transaction_date}
                  </Text>
                  {item.user_display_name || item.user_email ? (
                    <Text style={s.txAuthor} numberOfLines={1}>
                      oleh {item.user_display_name || item.user_email?.split('@')[0]}
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
            <Animated.View entering={FadeIn.duration(400)} style={s.emptyTxBox}>
              <Ionicons name="receipt-outline" size={42} color={Colors.textMuted} style={{ marginBottom: 6 }} />
              <Text style={s.emptyTxTitle}>{t('emptyTxTitle')}</Text>
              <Text style={s.emptyTxDesc}>
                {t('emptyTxDesc')}
              </Text>
            </Animated.View>
          ) : null
        }
      />

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
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // 1. FinWise Top Bar
  headerContainer: {
    backgroundColor: Colors.primary,
  },
  finTopBar: {
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 16,
  },

  // Hero Card (FinWise Emerald/Dark Card)
  heroCard: {
    backgroundColor: '#0E3E28', // FinWise deep emerald
    borderRadius: Radius.lg,
    padding: 20,
    gap: 16,
    ...Shadows.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  heroActionPlus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },
  heroActionPlusText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md,
    padding: 12,
  },
  metricItem: {
    flex: 1,
    gap: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 12,
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

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDark,
  },

  // Segmented Control
  periodSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    padding: 4,
    marginTop: 18,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  periodPillActive: {
    backgroundColor: Colors.card,
    ...Shadows.card,
  },
  periodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  periodPillTextActive: {
    color: Colors.primaryDark,
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

  // Transaction item (FinWise list row)
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    ...Shadows.card,
  },
  txIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
  emptyTxBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
    marginTop: 8,
  },
  emptyTxDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
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
});
