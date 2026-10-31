import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  useReducedMotion,
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
import { Colors, Shadows, Radius, Motion } from '@/constants/theme';
import { HomeSkeleton } from '@/components/Skeleton';
import { PressableScale, AnimatedProgressBar, FadeSlideIn, AnimatedFinanceAmount } from '@/components/Animated';
import { triggerDownloadApk } from '@/lib/downloadApp';
import OtterMascot from '@/components/OtterMascot';
import EmptyState from '@/components/EmptyState';
import { filterTransactions } from '@/lib/transactionSearch';
import { createDuplicateDraft } from '@/lib/transactionDuplicate';
import { generateTransactionsCsv, downloadTransactionsCsvWeb } from '@/lib/exportCsv';
import TransactionSearchBar from '@/components/TransactionSearchBar';
import ClayButton from '@/components/ClayButton';
import SplitSettlementCard from '@/components/SplitSettlementCard';
import {
  simplifyDebts,
  calculateNetBalancesFromSplits,
  type ExpenseSplit,
  type SettlementTransfer,
} from '@/lib/debtSimplifier';
import SavingsGoalCard from '@/components/SavingsGoalCard';
import { computeEnvelopeBalance, type SavingsGoal } from '@/lib/envelopeAccounting';
import UpcomingBillsCard from '@/components/UpcomingBillsCard';
import { getUrgentBills, type RecurringBill } from '@/lib/billReminderEngine';
import { supabase } from '@/lib/supabase';
import {
  isDateInPeriod,
  calculatePeriodSummary,
  type PeriodFilter,
} from '@/lib/periodFilter';

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
    budgets,
  } = useWorkspace();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    let isMounted = true;
    supabase
      .from('recurring_bills')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('is_active', true)
      .then(({ data }) => {
        if (isMounted && data) {
          setRecurringBills(data as RecurringBill[]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id]);

  const urgentBills = useMemo(() => {
    return getUrgentBills(recurringBills);
  }, [recurringBills]);

  const handlePayAndRecordBill = useCallback((bill: RecurringBill) => {
    const today = new Date().toISOString().split('T')[0];
    router.push({
      pathname: '/modal',
      params: {
        duplicateType: 'expense',
        duplicateAmount: String(bill.amount),
        duplicateCategory: bill.category,
        duplicateDescription: `Pembayaran ${bill.title}`,
        duplicateDate: today,
      },
    });
  }, [router]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    let isMounted = true;
    supabase
      .from('savings_goals')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('is_achieved', false)
      .then(({ data }) => {
        if (isMounted && data) {
          setSavingsGoals(data as SavingsGoal[]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id]);

  const envelope = useMemo(() => {
    return computeEnvelopeBalance(summary.income, summary.expense, savingsGoals);
  }, [summary.income, summary.expense, savingsGoals]);
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;
    let isMounted = true;
    interface SupabaseSplitRow {
      id: string;
      workspace_id: string;
      title: string;
      total_amount: number;
      paid_by?: string | null;
      split_participants?: Array<{
        id: string;
        split_id: string;
        user_id?: string | null;
        user_name: string;
        owed_amount: number;
        is_settled: boolean;
      }>;
    }
    supabase
      .from('expense_splits')
      .select('*, split_participants(*)')
      .eq('workspace_id', activeWorkspace.id)
      .then(({ data }) => {
        if (isMounted && data) {
          const rows = data as unknown as SupabaseSplitRow[];
          const formatted: ExpenseSplit[] = rows.map((d) => ({
            id: d.id,
            workspace_id: d.workspace_id,
            title: d.title,
            total_amount: Number(d.total_amount),
            paid_by: d.paid_by,
            paid_by_name: d.paid_by ? 'Anggota' : 'Admin',
            participants: (d.split_participants || []).map((p) => ({
              id: p.id,
              split_id: p.split_id,
              user_id: p.user_id,
              user_name: p.user_name,
              owed_amount: Number(p.owed_amount),
              is_settled: p.is_settled,
            })),
          }));
          setExpenseSplits(formatted);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id]);

  const simplifiedDebts = useMemo(() => {
    return simplifyDebts(calculateNetBalancesFromSplits(expenseSplits));
  }, [expenseSplits]);

  const handleSettleUp = useCallback((transfer: SettlementTransfer) => {
    const today = new Date().toISOString().split('T')[0];
    router.push({
      pathname: '/modal',
      params: {
        duplicateType: 'expense',
        duplicateAmount: String(transfer.amount),
        duplicateCategory: 'Patungan',
        duplicateDescription: `Pelunasan: ${transfer.fromName} ke ${transfer.toName}`,
        duplicateDate: today,
      },
    });
  }, [router]);



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

  const periodLabels = useMemo<Record<PeriodFilter, string>>(() => ({
    month: t('thisMonth'),
    week: t('thisWeek'),
    day: t('today'),
    all: t('allTime'),
  }), [t]);
  const activePeriodLabel = periodLabels[period];

  // Filter transaksi berdasarkan periode aktif
  const periodTransactions = useMemo(() => {
    if (!activeWorkspace) return [];
    const wsTransactions = transactions.filter(t => t.workspace_id === activeWorkspace.id);
    if (period === 'all') return wsTransactions;
    const now = new Date();
    return wsTransactions.filter(t => isDateInPeriod(t.transaction_date, period, now));
  }, [transactions, period, activeWorkspace]);

  // Ringkasan transaksi sesuai periode aktif (Hari Ini, Minggu Ini, Bulan Ini, Semua)
  const periodSummary = useMemo(() => {
    return calculatePeriodSummary(periodTransactions);
  }, [periodTransactions]);

  // Total pengeluaran bulan berjalan khusus untuk batas anggaran bulanan
  const currentMonthExpense = useMemo(() => {
    if (!activeWorkspace) return 0;
    const now = new Date();
    return transactions
      .filter(t => t.workspace_id === activeWorkspace.id && t.type === 'expense' && isDateInPeriod(t.transaction_date, 'month', now))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions, activeWorkspace]);

  // Filter transaksi berdasarkan pencarian dan tipe
  const filteredTransactions = useMemo(() => {
    return filterTransactions(periodTransactions, {
      query: searchQuery,
      type: activeTypeFilter,
    });
  }, [periodTransactions, searchQuery, activeTypeFilter]);

  const handleDuplicate = useCallback((tx: Transaction) => {
    const draft = createDuplicateDraft(tx);
    router.push({
      pathname: '/modal',
      params: {
        type: draft.type,
        amount: draft.amountInput,
        category: draft.category,
        description: draft.description,
      },
    });
  }, [router]);

  const handleExportCsv = useCallback(() => {
    const csv = generateTransactionsCsv(filteredTransactions);
    if (Platform.OS === 'web') {
      downloadTransactionsCsvWeb(csv, `transaksi-${activeWorkspace?.name || 'dompet'}.csv`);
    } else {
      Alert.alert('Export CSV', `Berhasil mengekspor ${filteredTransactions.length} transaksi.`);
    }
  }, [filteredTransactions, activeWorkspace]);

  // Rasio pengeluaran terhadap pemasukan periode ini (0-100)
  const expenseRatioPercent = periodSummary.income > 0
    ? Math.min(Math.round((periodSummary.expense / periodSummary.income) * 100), 100)
    : periodSummary.expense > 0 ? 100 : 0;

  // Total anggaran bulan berjalan yang benar-benar dikonfigurasi di workspace
  const totalBudget = useMemo(
    () => budgets.reduce((acc, b) => acc + (b.amount || 0), 0),
    [budgets]
  );
  const hasBudget = totalBudget > 0;

  // Progres anggaran nyata bulanan: total pengeluaran bulan ini / total anggaran (0-100)
  const budgetProgressPercent = hasBudget
    ? Math.min(Math.round((currentMonthExpense / totalBudget) * 100), 100)
    : 0;

  // Nilai yang ditampilkan di hero card: anggaran nyata bila ada, jika tidak rasio pengeluaran
  const heroGaugeValue = hasBudget ? budgetProgressPercent : expenseRatioPercent;
  const heroGaugeColor = heroGaugeValue > 90
    ? Colors.expense
    : heroGaugeValue > 75 ? Colors.warning : Colors.income;
  const heroGaugeBadgeBg = heroGaugeValue > 90
    ? 'rgba(220,76,64,0.25)'
    : heroGaugeValue > 75 ? 'rgba(229,138,58,0.25)' : 'rgba(46,139,87,0.25)';
  const heroGaugeStatus = heroGaugeValue > 90
    ? t('budgetCritical')
    : heroGaugeValue > 75 ? t('budgetWarning') : t('budgetHealthy');
  if (loadingWorkspaces && workspaces.length === 0) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <HomeSkeleton />
      </View>
    );
  }

  // Tampilan ketika belum ada workspace
  if (!activeWorkspace && workspaces.length === 0) {
    return (
      <View style={[s.root, s.emptyCenter, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Animated.View entering={reducedMotion ? FadeIn.duration(Motion.duration.fast) : FadeInUp.springify()} style={s.emptyBox}>
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
        <FadeSlideIn direction="down" delay={0} style={s.heroCard}>
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
              <AnimatedFinanceAmount value={summary.balance} style={s.heroAmount} />
            </View>
            <View style={s.heroMascotWrap}>
              <OtterMascot
                variant={summary.balance >= 0 ? 'rich' : 'panic'}
                size="md"
              />
            </View>
          </View>

          {/* Mini Two-Column Metrics: separate mini-cards */}
          <View style={s.metricsRow}>
            <View style={[s.metricItem, s.metricIncome]}>
              <View style={s.metricHeader}>
                <Ionicons name="arrow-up-circle" size={16} color={Colors.income} />
                <Text style={[s.metricLabel, { color: Colors.primarySoft }]}>
                  {t('income')} <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>({activePeriodLabel})</Text>
                </Text>
              </View>
              <AnimatedFinanceAmount value={periodSummary.income} style={[s.metricValue, { color: Colors.incomeSoft }]} />
            </View>
            <View style={[s.metricItem, s.metricExpense]}>
              <View style={s.metricHeader}>
                <Ionicons name="arrow-down-circle" size={16} color={Colors.expense} />
                <Text style={[s.metricLabel, { color: Colors.expenseSoft }]}>
                  {t('expense')} <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>({activePeriodLabel})</Text>
                </Text>
              </View>
              <AnimatedFinanceAmount value={periodSummary.expense} style={[s.metricValue, { color: Colors.expenseSoft }]} />
            </View>
          </View>

          {/* Budget Progress Bar: anggaran nyata bila dikonfigurasi */}
          <View style={s.budgetSection}>
            <View style={s.budgetHeader}>
              <Text style={s.budgetTitle}>
                {hasBudget ? `${t('budgetUsed')} (${t('thisMonth')})` : `${t('expenseRatio')} (${activePeriodLabel})`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.budgetPercent, { color: heroGaugeColor }]}>{heroGaugeValue}%</Text>
                <View style={[s.budgetBadge, { backgroundColor: heroGaugeBadgeBg }]}>
                  <Text style={[s.budgetBadgeText, { color: heroGaugeColor }]}>
                    {heroGaugeStatus}
                  </Text>
                </View>
              </View>
            </View>
            <AnimatedProgressBar
              progress={heroGaugeValue}
              color={heroGaugeColor}
              trackColor="rgba(255,255,255,0.15)"
              height={8}
            />
            {hasBudget && (
              <Text style={s.budgetFootnote}>
                {formatRupiah(currentMonthExpense)} / {formatRupiah(totalBudget)}
              </Text>
            )}
          </View>
          {/* ENVELOPE SUB-BALANCES (Sprint 3) */}
          {savingsGoals.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 }}>
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Siap Pakai</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: envelope.isOverallocated ? '#FCA5A5' : '#FFFFFF' }}>
                  {formatRupiah(envelope.freeToSpend)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Terkunci di Goals</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                  {formatRupiah(envelope.reservedInGoals)}
                </Text>
              </View>
            </View>
          )}
        </FadeSlideIn>

        {/* QUICK ACTIONS ROW */}
        <FadeSlideIn delay={100} style={s.quickActionsRow}>
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
            onPress={handleExportCsv}
          >
            <View style={[s.quickActionIcon, { backgroundColor: '#F0E7DE' }]}>
              <Ionicons name="download-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={s.quickActionLabel}>Export CSV</Text>
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
        </FadeSlideIn>

        {/* PERIOD FILTER (FinWise Segmented Control) */}
        <FadeSlideIn delay={150} style={s.periodSegment}>
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
        </FadeSlideIn>

        {urgentBills.length > 0 && (
          <FadeSlideIn delay={170}>
            <UpcomingBillsCard
              bills={urgentBills}
              onPayAndRecord={handlePayAndRecordBill}
            />
          </FadeSlideIn>
        )}

        {/* SAVINGS GOALS (Sprint 3) */}
        {savingsGoals.length > 0 && (
          <FadeSlideIn delay={160}>
            <SavingsGoalCard
              goals={savingsGoals}
              onContribute={(goal) => {
                router.push({
                  pathname: '/modal',
                  params: {
                    duplicateType: 'expense',
                    duplicateAmount: '100000',
                    duplicateCategory: 'Tabungan',
                    duplicateDescription: `Nabung untuk ${goal.title}`,
                    duplicateDate: new Date().toISOString().split('T')[0],
                  },
                });
              }}
            />
          </FadeSlideIn>
        )}

        {/* SETTLE UP (Sprint 4) */}
        {simplifiedDebts.length > 0 && (
          <FadeSlideIn delay={165}>
            <SplitSettlementCard
              transfers={simplifiedDebts}
              onSettleUp={handleSettleUp}
            />
          </FadeSlideIn>
        )}

        {/* SECTION TITLE */}
        <FadeSlideIn delay={180} style={s.txSectionHeader}>
          <Text style={s.txSectionTitle}>{t('recentTx')}</Text>
          <Text style={s.txSectionCount}>
            {filteredTransactions.length} {t('txCount')}
          </Text>
        </FadeSlideIn>
        {/* SEARCH BAR & FILTER CHIPS */}
        <FadeSlideIn delay={190}>
          <TransactionSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTypeFilter={activeTypeFilter}
            onTypeFilterChange={setActiveTypeFilter}
          />
        </FadeSlideIn>

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
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.modalActionBtnText}>{t('newWallet')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.modalActionBtn, s.modalActionBtnOutline]}
            onPress={() => {
              setShowSwitchModal(false);
              router.push('/(tabs)/two');
            }}
          >
            <Ionicons name="enter-outline" size={16} color={Colors.primary} />
            <Text style={s.modalActionBtnTextOutline}>{t('joinOther')}</Text>
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
              Halo, {displayName}
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
              <Ionicons name="wallet-outline" size={isTablet ? 13 : 16} color={Colors.primaryDark} />
              <Text style={[s.desktopPillPrefix, isTablet && s.desktopPillPrefixTablet]}>Dompet:</Text>
              <Text style={[s.desktopPillText, isTablet && s.desktopPillTextTablet]} numberOfLines={1}>
                {activeWorkspace?.name || 'Utama'}
              </Text>
              <Ionicons name="chevron-down" size={isTablet ? 12 : 14} color={Colors.textSecondary} />
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
              <Ionicons name="notifications-outline" size={isTablet ? 18 : 20} color={Colors.primaryDark} />
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
                  <Text style={[s.desktopKpiSubLight, isTablet && { fontSize: 10 }]}>• Dompet: {activeWorkspace?.name || 'Utama'}</Text>
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
                <View
                  style={[
                    periodSummary.balance > 0
                      ? s.desktopBadgeGreen
                      : periodSummary.balance < 0
                      ? s.desktopBadgeRed
                      : s.desktopBadgeNeutral,
                    isTablet && { paddingVertical: 2, paddingHorizontal: 6 },
                  ]}
                >
                  <Ionicons
                    name={
                      periodSummary.balance > 0
                        ? 'trending-up'
                        : periodSummary.balance < 0
                        ? 'trending-down'
                        : 'remove-outline'
                    }
                    size={isTablet ? 10 : 12}
                    color={
                      periodSummary.balance > 0
                        ? Colors.income
                        : periodSummary.balance < 0
                        ? Colors.expense
                        : 'rgba(255,255,255,0.9)'
                    }
                  />
                  <Text
                    style={[
                      periodSummary.balance > 0
                        ? s.desktopBadgeGreenText
                        : periodSummary.balance < 0
                        ? s.desktopBadgeRedText
                        : s.desktopBadgeNeutralText,
                      isTablet && { fontSize: 10 },
                    ]}
                  >
                    {periodSummary.balance > 0
                      ? `+Surplus ${formatRupiah(periodSummary.balance)}`
                      : periodSummary.balance < 0
                      ? `Defisit ${formatRupiah(Math.abs(periodSummary.balance))}`
                      : 'Arus Kas Seimbang'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.desktopRecordBtn, isTablet && s.desktopRecordBtnTablet]}
                  onPress={() => router.push('/modal')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={isTablet ? 14 : 16} color={Colors.primaryDark} />
                  <Text style={[s.desktopRecordBtnText, isTablet && s.desktopRecordBtnTextTablet]}>{t('recordBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* CARD 2: PEMASUKAN */}
            <View style={[s.desktopKpiCard, isTablet && s.desktopKpiCardTablet]}>
              <View style={s.desktopKpiHeaderRow}>
                <View style={[s.desktopKpiIconCircle, isTablet && { width: 30, height: 30 }, { backgroundColor: Colors.primarySoft }]}>
                  <Ionicons name="arrow-up" size={isTablet ? 15 : 18} color={Colors.income} />
                </View>
                <Text style={[s.desktopKpiLabel, isTablet && { fontSize: 12 }]}>{t('income')}</Text>
                <View style={s.desktopKpiPeriodChip}>
                  <Text style={s.desktopKpiPeriodChipText}>{activePeriodLabel}</Text>
                </View>
              </View>
              <Text
                style={[s.desktopKpiAmount, isTablet && s.desktopKpiAmountTablet, { color: Colors.income }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatRupiah(periodSummary.income)}
              </Text>
              <Text style={[s.desktopKpiFootnote, isTablet && s.desktopKpiFootnoteTablet]} numberOfLines={1}>
                Total pemasukan tercatat • {activePeriodLabel}
              </Text>
            </View>

            {/* CARD 3: PENGELUARAN */}
            <View style={[s.desktopKpiCard, isTablet && s.desktopKpiCardTablet]}>
              <View style={s.desktopKpiHeaderRow}>
                <View style={[s.desktopKpiIconCircle, isTablet && { width: 30, height: 30 }, { backgroundColor: Colors.expenseSoft }]}>
                  <Ionicons name="arrow-down" size={isTablet ? 15 : 18} color={Colors.expense} />
                </View>
                <Text style={[s.desktopKpiLabel, isTablet && { fontSize: 12 }]}>{t('expense')}</Text>
                <View style={s.desktopKpiPeriodChip}>
                  <Text style={s.desktopKpiPeriodChipText}>{activePeriodLabel}</Text>
                </View>
              </View>
              <Text
                style={[s.desktopKpiAmount, isTablet && s.desktopKpiAmountTablet, { color: Colors.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatRupiah(periodSummary.expense)}
              </Text>
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: isTablet ? 10 : 11, color: Colors.textSecondary, fontWeight: '600' }}>
                    Rasio Pengeluaran • {activePeriodLabel}
                  </Text>
                  <Text style={{ fontSize: isTablet ? 10 : 11, color: expenseRatioPercent > 90 ? Colors.expense : Colors.income, fontWeight: '800' }}>
                    {expenseRatioPercent}%
                  </Text>
                </View>
                <AnimatedProgressBar
                  progress={expenseRatioPercent}
                  color={expenseRatioPercent > 90 ? Colors.expense : expenseRatioPercent > 75 ? Colors.warning : Colors.income}
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
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <ClayButton
                    variant="secondary"
                    size="sm"
                    icon="download-outline"
                    label="Export CSV"
                    onPress={handleExportCsv}
                  />
                  <ClayButton
                    variant="primary"
                    size="sm"
                    icon="add"
                    label="Tambah Transaksi"
                    onPress={() => router.push('/modal')}
                  />
                </View>
              </View>

              {urgentBills.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <UpcomingBillsCard
                    bills={urgentBills}
                    onPayAndRecord={handlePayAndRecordBill}
                  />
                </View>
              )}

              {simplifiedDebts.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <SplitSettlementCard
                    transfers={simplifiedDebts}
                    onSettleUp={handleSettleUp}
                  />
                </View>
              )}

              <View style={{ marginBottom: 12 }}>
                <TransactionSearchBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeTypeFilter={activeTypeFilter}
                  onTypeFilterChange={setActiveTypeFilter}
                />
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                            <Text style={s.txDateText}>{item.transaction_date}</Text>
                            <TouchableOpacity
                              onPress={() => handleDuplicate(item)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              accessibilityLabel="Duplikat transaksi"
                            >
                              <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
                            </TouchableOpacity>
                          </View>
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
                  <Ionicons name="home-outline" size={18} color={Colors.primaryDark} />
                  <Text style={s.desktopSideCardTitle}>Dompet Keluarga</Text>
                </View>
                <Text style={s.desktopWsName}>{activeWorkspace?.name || 'Dompet Bareng'}</Text>
                <Text style={s.desktopWsRole}>
                  Peran: {activeWorkspace?.role === 'admin' ? 'Pemilik (Admin)' : 'Anggota'}
                </Text>
                <View style={s.desktopWsActions}>
                  <View style={{ flex: 1 }}>
                    <ClayButton
                      variant="secondary"
                      size="sm"
                      icon="swap-horizontal"
                      label="Ganti Dompet"
                      onPress={() => setShowSwitchModal(true)}
                      fullWidth
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ClayButton
                      variant="secondary"
                      size="sm"
                      icon="people-outline"
                      label="Kelola Anggota"
                      onPress={() => router.push('/(tabs)/two')}
                      fullWidth
                    />
                  </View>
                </View>
              </View>

              {/* CARD 2: PROGRES ANGGARAN */}
              <View style={s.desktopSideCard}>
                <View style={s.desktopSideCardHeader}>
                  <Ionicons name="pie-chart-outline" size={18} color={Colors.primaryDark} />
                  <Text style={s.desktopSideCardTitle}>Progres Anggaran Bulan Ini</Text>
                </View>
                {hasBudget ? (
                  <View style={{ marginVertical: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, color: Colors.textSecondary, fontWeight: '600' }}>
                        Status: {budgetProgressPercent > 90 ? 'Perhatian!' : budgetProgressPercent > 70 ? 'Waspada' : 'Aman'}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: budgetProgressPercent > 90 ? Colors.expense : Colors.income }}>
                        {budgetProgressPercent}%
                      </Text>
                    </View>
                    <AnimatedProgressBar
                      progress={budgetProgressPercent}
                      color={budgetProgressPercent > 90 ? Colors.expense : budgetProgressPercent > 75 ? Colors.warning : Colors.income}
                      height={8}
                    />
                    <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 6 }}>
                      {formatRupiah(currentMonthExpense)} terpakai dari {formatRupiah(totalBudget)}
                    </Text>
                    <Text style={[s.desktopBudgetNote, { marginTop: 8 }]}>
                      {budgetProgressPercent > 90
                        ? 'Pengeluaran hampir menyentuh batas anggaran. Tinjau kembali pos belanja.'
                        : 'Pengeluaran masih dalam batas anggaran bulan ini. Pertahankan pola hemat keluarga!'}
                    </Text>
                    <TouchableOpacity
                      style={s.desktopManageBudgetBtn}
                      onPress={() => router.push('/(tabs)/statistics')}
                      activeOpacity={0.8}
                    >
                      <Text style={s.desktopManageBudgetBtnText}>Kelola Anggaran</Text>
                      <Ionicons name="chevron-forward" size={13} color={Colors.primaryDark} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.desktopEmptyBudgetBox}>
                    <View style={s.desktopEmptyBudgetIconWrap}>
                      <Ionicons name="pie-chart-outline" size={24} color={Colors.primaryDark} />
                    </View>
                    <Text style={s.desktopEmptyBudgetTitle}>Belum Ada Anggaran</Text>
                    <Text style={s.desktopEmptyBudgetDesc}>
                      Batas anggaran bulanan belum diatur. Pasang batas agar pengeluaran keluarga lebih terencana.
                    </Text>
                    <Text style={s.desktopEmptyBudgetFootnote}>
                      Pengeluaran bulan ini: {formatRupiah(currentMonthExpense)}
                    </Text>
                    <TouchableOpacity
                      style={s.desktopSetBudgetBtn}
                      onPress={() => router.push('/(tabs)/statistics')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
                      <Text style={s.desktopSetBudgetBtnText}>Atur Batas Anggaran</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* CARD 3: TARGET TABUNGAN (Sprint 3) */}
              {savingsGoals.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <SavingsGoalCard
                    goals={savingsGoals}
                    onContribute={(goal) => {
                      router.push({
                        pathname: '/modal',
                        params: {
                          duplicateType: 'expense',
                          duplicateAmount: '100000',
                          duplicateCategory: 'Tabungan',
                          duplicateDescription: `Nabung untuk ${goal.title}`,
                          duplicateDate: new Date().toISOString().split('T')[0],
                        },
                      });
                    }}
                  />
                </View>
              )}

              {/* CARD 3: INSIGHT KEUANGAN BERSAMA OTTER */}
              <View style={s.desktopOtterCard}>
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                  <OtterMascot
                    variant={heroGaugeValue > 90 ? 'panic' : summary.balance > 0 ? 'rich' : 'happy'}
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
                  <Text style={s.desktopOtterBtnText}>Lihat Analisis Lengkap</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
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
            <Animated.View entering={reducedMotion ? FadeIn.duration(150) : FadeInUp.delay(Math.min(index, 10) * 35).duration(300)}>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                    <Text style={s.txDateText}>{item.transaction_date}</Text>
                    <TouchableOpacity
                      onPress={() => handleDuplicate(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Duplikat transaksi"
                    >
                      <Ionicons name="copy-outline" size={13} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
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
    backgroundColor: Colors.background,
  },

  // 1. Top Bar
  headerContainer: {
    backgroundColor: Colors.primaryDark,
  },
  finTopBar: {
    backgroundColor: Colors.primaryDark,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
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

  // Hero Card
  heroCard: {
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: 'rgba(46, 139, 87, 0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(46, 139, 87, 0.60)',
  },
  metricExpense: {
    backgroundColor: 'rgba(220, 76, 64, 0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(220, 76, 64, 0.60)',
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
  budgetFootnote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 2,
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
    borderColor: Colors.border,
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
    backgroundColor: Colors.cardAlt,
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
    borderColor: Colors.border,
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
    backgroundColor: Colors.savingsSoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  editedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
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
    backgroundColor: Colors.background,
  },
  desktopHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopGreetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.3,
  },
  desktopGreetingSub: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  desktopPillPrefix: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  desktopPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    maxWidth: 160,
  },
  desktopPeriodPills: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
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
    color: Colors.textSecondary,
  },
  desktopPeriodPillTextActive: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  desktopNotifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  desktopAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: 'rgba(46,139,87,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  desktopBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.income,
  },
  desktopBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220,76,64,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  desktopBadgeRedText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.expense,
  },
  desktopBadgeNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
  },
  desktopBadgeNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
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
    color: Colors.primaryDark,
  },
  desktopKpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
  },
  desktopKpiPeriodChip: {
    backgroundColor: Colors.cardAlt,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginLeft: 'auto',
  },
  desktopKpiPeriodChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  desktopKpiAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  desktopKpiFootnote: {
    fontSize: 11,
    color: Colors.textMuted,
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
    color: Colors.primaryDark,
  },
  desktopSectionCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  desktopAddTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.22)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(46, 24, 14, 0.28)',
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(35, 18, 10, 0.45)',
    shadowColor: '#5C2A12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 6,
  },
  desktopAddTxBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  desktopTxList: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderColor: Colors.border,
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
    color: Colors.primaryDark,
  },
  desktopWsName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  desktopWsRole: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderTopWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftWidth: 1.5,
    borderLeftColor: '#FFFFFF',
    borderRightWidth: 1.5,
    borderRightColor: '#E6D7C8',
    borderBottomWidth: 2.5,
    borderBottomColor: '#D3BFAB',
    shadowColor: '#6B3A17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  desktopOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  desktopBudgetNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  desktopManageBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  desktopManageBudgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  desktopEmptyBudgetBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  desktopEmptyBudgetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  desktopEmptyBudgetTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  desktopEmptyBudgetDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  desktopEmptyBudgetFootnote: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 12,
  },
  desktopSetBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
  },
  desktopSetBudgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  desktopOtterCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    alignItems: 'center',
    ...Shadows.card,
  },
  desktopOtterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 6,
    textAlign: 'center',
  },
  desktopOtterText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  desktopOtterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
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
  desktopPillPrefixTablet: {
    fontSize: 10,
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
