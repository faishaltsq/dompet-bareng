import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useWorkspace, WorkspaceBudget } from '@/context/WorkspaceContext';
import { formatRupiah, getCategoryMeta, EXPENSE_CATEGORIES, formatCurrencyInput } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedProgressBar } from '@/components/Animated';
import SwipeableModal from '@/components/SwipeableModal';
import { useLanguage } from '@/context/LanguageContext';
import CalendarDropdownModal, { DateFilterState } from '@/components/CalendarDropdownModal';
import PieChart, { PieSlice } from '@/components/PieChart';
import OtterMascot from '@/components/OtterMascot';
import EmptyState from '@/components/EmptyState';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TabType = 'expense' | 'income';

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { t, language } = useLanguage();
  const MONTHS = language === 'id' ? MONTHS_ID : MONTHS_EN;
  const { activeWorkspace, transactions, loadingTx, budgets, setBudget, updateBudget, deleteBudget } = useWorkspace();
  const isAdmin = activeWorkspace?.role === 'admin';
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<WorkspaceBudget | null>(null);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0] as string);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [tab, setTab] = useState<TabType>('expense');
  const [showPieChart, setShowPieChart] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);

  // Flexible date filter (replaces old selectedMonth)
  const getDefaultFilter = useCallback((): DateFilterState => {
    const d = new Date();
    const m = d.getMonth();
    const y = d.getFullYear();
    const days = new Date(y, m + 1, 0).getDate();
    return {
      type: 'month',
      label: `${MONTHS[m]} ${y}`,
      monthIndex: m,
      year: y,
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
    };
  }, [MONTHS]);

  const [dateFilter, setDateFilter] = useState<DateFilterState>(() => getDefaultFilter());

  // Refresh default month filter when screen comes back into focus
  // so stale month/year doesn't linger across midnight or month boundaries
  useFocusEffect(useCallback(() => {
    setDateFilter(prev => {
      if (prev.type !== 'month') return prev; // user picked a custom range — don't clobber
      return getDefaultFilter();
    });
  }, [getDefaultFilter]));

  const filtered = useMemo(() => {
    if (!activeWorkspace) return [];
    const wsTx = transactions.filter(t => t.workspace_id === activeWorkspace.id);

    if (dateFilter.type === 'all') return wsTx;

    const start = dateFilter.startDate;
    const end = dateFilter.endDate;
    if (!start || !end) return wsTx;

    return wsTx.filter(t => {
      const d = t.transaction_date.slice(0, 10); // YYYY-MM-DD
      return d >= start && d <= end;
    });
  }, [transactions, dateFilter, activeWorkspace]);

  // Set of dates that have transactions (for calendar dot markers)
  const txDateSet = useMemo(() => {
    if (!activeWorkspace) return new Set<string>();
    return new Set(
      transactions
        .filter(t => t.workspace_id === activeWorkspace.id)
        .map(t => t.transaction_date.slice(0, 10))
    );
  }, [transactions, activeWorkspace]);

  const monthSummary = useMemo(() =>
    filtered.reduce((acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 }),
    [filtered]
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === tab).forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered, tab]);

  const totalForTab = tab === 'expense' ? monthSummary.expense : monthSummary.income;
  const balance = monthSummary.income - monthSummary.expense;

  // Pie chart slices — warna mengikuti kategori transaksi
  const pieSlices = useMemo<PieSlice[]>(() => {
    if (totalForTab === 0) return [];
    return byCategory.map(([cat, amount]) => ({
      key: cat,
      label: cat,
      value: amount,
      color: getCategoryMeta(cat).color,
      percentage: (amount / totalForTab) * 100,
    }));
  }, [byCategory, totalForTab]);

  const handleOpenAddBudget = () => {
    setEditingBudget(null);
    const existingCategories = new Set(budgets.map(b => b.category));
    const available = EXPENSE_CATEGORIES.find(cat => !existingCategories.has(cat)) || EXPENSE_CATEGORIES[0];
    setBudgetCategory(available);
    setBudgetAmount('');
    setBudgetModalVisible(true);
  };

  const handleOpenEditBudget = (b: WorkspaceBudget) => {
    if (!isAdmin) return;
    setEditingBudget(b);
    setBudgetCategory(b.category);
    setBudgetAmount(formatCurrencyInput(b.amount.toString()));
    setBudgetModalVisible(true);
  };

  const handleSaveBudget = async () => {
    const raw = budgetAmount.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    if (!num || num <= 0) {
      Alert.alert(t('alertAttention'), t('alertBudgetAmountInvalid'));
      return;
    }

    setSavingBudget(true);
    let ok = false;
    if (editingBudget) {
      ok = await updateBudget(editingBudget.id, budgetCategory, num, editingBudget.category);
    } else {
      ok = await setBudget(budgetCategory, num);
    }
    setSavingBudget(false);

    if (ok) {
      setBudgetModalVisible(false);
      setEditingBudget(null);
      setBudgetAmount('');
    }
  };

  const handleDeleteBudget = (budget: WorkspaceBudget) => {
    const doDelete = async () => {
      setSavingBudget(true);
      const ok = await deleteBudget(budget.id);
      setSavingBudget(false);
      if (ok) {
        setBudgetModalVisible(false);
        setEditingBudget(null);
        setBudgetAmount('');
      } else {
        Alert.alert(t('alertFailed'), t('alertDeleteBudgetFailed'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('deleteBudgetConfirm') || `Hapus batas anggaran untuk kategori "${budget.category}"?`)) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      t('deleteBudgetBtn') || 'Hapus Anggaran',
      t('deleteBudgetConfirm') || `Hapus batas anggaran untuk kategori "${budget.category}"?`,
      [
        { text: t('cancel') || 'Batal', style: 'cancel' },
        { text: t('budgetDelete') || 'Hapus', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const modals = (
    <>
      <SwipeableModal
        visible={budgetModalVisible}
        onClose={() => {
          setBudgetModalVisible(false);
          setEditingBudget(null);
        }}
      >
        <Text style={s.sheetTitle}>
          {editingBudget ? t('editBudgetTitle') : t('setBudgetTitle')}
        </Text>
        <Text style={s.sheetSubtitle}>
          {editingBudget ? t('editBudgetSubtitle') : t('setBudgetSubtitle')}
        </Text>

        {/* Category selector */}
        <Text style={s.inputSectionLabel}>{t('categoryLabel') || 'Kategori'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {EXPENSE_CATEGORIES.map(cat => {
            const isSelected = budgetCategory === cat;
            const cMeta = getCategoryMeta(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  s.catChip,
                  isSelected && {
                    backgroundColor: cMeta.bg,
                    borderColor: cMeta.color,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setBudgetCategory(cat)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cMeta.icon || 'receipt-outline'}
                  size={14}
                  color={isSelected ? cMeta.color : Colors.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    s.catChipText,
                    isSelected && { color: cMeta.color, fontWeight: '800' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Nominal input */}
        <Text style={s.inputSectionLabel}>{t('labelBudgetAmount')}</Text>
        <TextInput
          style={s.sheetInput}
          value={budgetAmount}
          onChangeText={val => setBudgetAmount(formatCurrencyInput(val))}
          placeholder={t('budgetPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
        />

        {/* Quick Amount Row */}
        <View style={s.quickAmountRow}>
          {['500.000', '1.000.000', '2.000.000', '5.000.000'].map(amt => (
            <TouchableOpacity
              key={amt}
              style={s.quickAmountBtn}
              onPress={() => setBudgetAmount(amt)}
              activeOpacity={0.7}
            >
              <Text style={s.quickAmountBtnText}>Rp {amt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.sheetBtn, savingBudget && { opacity: 0.6 }]}
          onPress={handleSaveBudget}
          disabled={savingBudget}
          activeOpacity={0.8}
        >
          {savingBudget ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sheetBtnText}>
              {editingBudget ? t('saveChangesBtn') : t('saveBudgetBtn')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Delete budget button (if in editing mode) */}
        {editingBudget && (
          <TouchableOpacity
            style={s.deleteBudgetBtn}
            onPress={() => handleDeleteBudget(editingBudget)}
            disabled={savingBudget}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.expense} style={{ marginRight: 6 }} />
            <Text style={s.deleteBudgetBtnText}>{t('deleteBudgetBtn')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => {
            setBudgetModalVisible(false);
            setEditingBudget(null);
          }}
          style={s.cancelBtn}
        >
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>

      <CalendarDropdownModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        currentFilter={dateFilter}
        onSelectFilter={setDateFilter}
        transactionDates={txDateSet}
      />
    </>
  );

  if (isDesktop) {
    return (
      <View style={s.desktopContainer}>
        <StatusBar style="dark" />

        {/* 1. DESKTOP HEADER */}
        <View style={s.desktopHeader}>
          <View>
            <Text style={s.desktopTitle}>{t('statsTitle')} 📊</Text>
            <Text style={s.desktopSubtitle}>Lihat pola dan tren pengeluaran keluarga</Text>
          </View>

          <View style={s.desktopActions}>
            {activeWorkspace && (
              <View style={s.desktopWsPill}>
                <Ionicons name="home" size={14} color={Colors.forestGreen} />
                <Text style={s.desktopWsPillText}>{activeWorkspace.name}</Text>
              </View>
            )}

            <TouchableOpacity
              style={s.desktopCalendarBtn}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={15} color="#0F3832" />
              <Text style={s.desktopCalendarText}>{dateFilter.label}</Text>
              <Ionicons name="chevron-down" size={13} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. DESKTOP BODY SCROLL */}
        <ScrollView
          style={s.desktopScroll}
          contentContainerStyle={s.desktopScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ROW 1: 3 KPI CARDS */}
          <View style={s.desktopKpiRow}>
            {/* CARD 1: PEMASUKAN */}
            <View style={s.desktopKpiCard}>
              <View style={s.desktopKpiHeader}>
                <View style={[s.desktopKpiIconWrap, { backgroundColor: '#E8F8F5' }]}>
                  <Ionicons name="arrow-up" size={18} color="#00A86B" />
                </View>
                <Text style={s.desktopKpiLabel}>{t('income')}</Text>
              </View>
              <Text style={[s.desktopKpiAmt, { color: Colors.income }]}>
                {formatRupiah(monthSummary.income)}
              </Text>
              <Text style={s.desktopKpiSub}>Pemasukan periode {dateFilter.label}</Text>
            </View>

            {/* CARD 2: PENGELUARAN */}
            <View style={s.desktopKpiCard}>
              <View style={s.desktopKpiHeader}>
                <View style={[s.desktopKpiIconWrap, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="arrow-down" size={18} color="#FA5A5A" />
                </View>
                <Text style={s.desktopKpiLabel}>{t('expense')}</Text>
              </View>
              <Text style={[s.desktopKpiAmt, { color: Colors.expense }]}>
                {formatRupiah(monthSummary.expense)}
              </Text>
              <Text style={s.desktopKpiSub}>Pengeluaran periode {dateFilter.label}</Text>
            </View>

            {/* CARD 3: SALDO BERSIH DENGAN OTTER */}
            <View style={s.desktopKpiCardPrimary}>
              <View style={s.desktopKpiHeader}>
                <View>
                  <Text style={s.desktopKpiLabelLight}>{t('netBalance')}</Text>
                  <Text style={s.desktopKpiSubLight}>Periode: {dateFilter.label}</Text>
                </View>
                <View style={s.desktopOtterWrap}>
                  <OtterMascot
                    variant={balance > 0 ? 'happy' : balance < 0 ? 'crying' : 'thinking'}
                    size="sm"
                  />
                </View>
              </View>
              <Text style={s.desktopKpiAmtLight}>
                {balance >= 0 ? '+' : ''}{formatRupiah(balance)}
              </Text>
              <View style={s.desktopBadgeGreen}>
                <Text style={s.desktopBadgeGreenText}>
                  {balance >= 0 ? 'Surplus Finansial' : 'Defisit Anggaran'}
                </Text>
              </View>
            </View>
          </View>

          {/* ROW 2: TWO-COLUMN GRID */}
          <View style={s.desktopContentGrid}>
            {/* LEFT COLUMN: TREN & BREAKDOWN KATEGORI */}
            <View style={s.desktopLeftCol}>
              {/* Comparative bars */}
              <View style={s.desktopCardBox}>
                <Text style={s.desktopCardBoxTitle}>Rasio Pemasukan vs Pengeluaran</Text>
                <View style={s.comparativeBarsWrap}>
                  <View style={s.barHeaderRow}>
                    <View style={s.barLabelGroup}>
                      <Ionicons name="arrow-up-circle-outline" size={14} color={Colors.income} />
                      <Text style={s.barLabel}>{t('income')}</Text>
                    </View>
                    <Text style={[s.barValue, { color: Colors.income }]}>
                      {monthSummary.income > 0
                        ? `${Math.round((monthSummary.income / Math.max(monthSummary.income, monthSummary.expense)) * 100)}%`
                        : '0%'}
                    </Text>
                  </View>
                  <AnimatedProgressBar
                    progress={monthSummary.income > 0
                      ? (monthSummary.income / Math.max(monthSummary.income, monthSummary.expense)) * 100
                      : 0}
                    color={Colors.income}
                    height={7}
                    borderRadius={4}
                  />

                  <View style={[s.barHeaderRow, { marginTop: 8 }]}>
                    <View style={s.barLabelGroup}>
                      <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.expense} />
                      <Text style={s.barLabel}>{t('expense')}</Text>
                    </View>
                    <Text style={[s.barValue, { color: Colors.expense }]}>
                      {monthSummary.expense > 0
                        ? `${Math.round((monthSummary.expense / Math.max(monthSummary.income, monthSummary.expense)) * 100)}%`
                        : '0%'}
                    </Text>
                  </View>
                  <AnimatedProgressBar
                    progress={monthSummary.expense > 0
                      ? (monthSummary.expense / Math.max(monthSummary.income, monthSummary.expense)) * 100
                      : 0}
                    color={Colors.expense}
                    height={7}
                    borderRadius={4}
                  />
                </View>
              </View>

              {/* Tab Switch & Pie Chart */}
              <View style={s.desktopCardBox}>
                <View style={s.tabSwitch}>
                  <TouchableOpacity
                    style={[s.tabBtn, tab === 'expense' && s.tabBtnActiveExpense]}
                    onPress={() => setTab('expense')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="arrow-down-circle-outline"
                      size={16}
                      color={tab === 'expense' ? Colors.expense : Colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[s.tabBtnText, tab === 'expense' && s.tabBtnTextActiveExpense]}>
                      {t('expense')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tabBtn, tab === 'income' && s.tabBtnActiveIncome]}
                    onPress={() => setTab('income')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={16}
                      color={tab === 'income' ? Colors.income : Colors.textMuted}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[s.tabBtnText, tab === 'income' && s.tabBtnTextActiveIncome]}>
                      {t('income')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {pieSlices.length > 0 && (
                  <View style={{ alignItems: 'center', marginVertical: 16 }}>
                    <PieChart
                      data={pieSlices}
                      total={totalForTab}
                      size={220}
                      showNegative={tab === 'expense'}
                      formatValue={(v) => formatRupiah(tab === 'expense' ? -v : v)}
                    />
                  </View>
                )}

                {/* Categories */}
                <View style={{ marginTop: 12 }}>
                  {loadingTx ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                  ) : byCategory.length === 0 ? (
                    <EmptyState
                      mascot="thinking"
                      title={language === 'id' ? 'Belum Ada Transaksi' : 'No Transactions Yet'}
                      subtitle={`Tidak ada data ${tab === 'expense' ? 'pengeluaran' : 'pemasukan'} pada periode ini.`}
                      compact
                    />
                  ) : (
                    byCategory.map(([cat, amount], index) => {
                      const meta = getCategoryMeta(cat);
                      const pct = totalForTab > 0 ? Math.round((amount / totalForTab) * 100) : 0;
                      return (
                        <View key={cat} style={s.catCard}>
                          <View style={[s.catIcon, { backgroundColor: meta.bg }]}>
                            <Ionicons name={meta.icon || 'receipt-outline'} size={22} color={meta.color} />
                          </View>
                          <View style={s.catMid}>
                            <View style={s.catNameRow}>
                              <Text style={s.catName}>{cat}</Text>
                              <Text style={[s.catPct, { color: meta.color }]}>{pct}%</Text>
                            </View>
                            <AnimatedProgressBar
                              progress={pct}
                              color={meta.color}
                              height={5}
                              borderRadius={3}
                              style={{ marginTop: 6 }}
                            />
                            <Text style={s.catAmt}>{formatRupiah(amount)}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </View>

            {/* RIGHT COLUMN: BATAS ANGGARAN & OTTER MASCOT */}
            <View style={s.desktopRightCol}>
              {/* Budgets Limit */}
              {tab === 'expense' && (
                <View style={s.desktopCardBox}>
                  <View style={s.budgetHeaderRow}>
                    <View>
                      <Text style={s.budgetSectionTitle}>{t('categoryBudgetLimits')}</Text>
                      <Text style={s.budgetSectionSubtitle}>Target & batasan belanja bulanan</Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity
                        style={s.setBudgetBtn}
                        onPress={handleOpenAddBudget}
                      >
                        <Text style={s.setBudgetBtnText}>+ {t('setBudget')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {budgets.length === 0 ? (
                    <View style={s.noBudgetBox}>
                      <Text style={s.noBudgetText}>{t('noBudgetYet')}</Text>
                      {isAdmin && (
                        <TouchableOpacity onPress={handleOpenAddBudget}>
                          <Text style={s.noBudgetAction}>+ {t('setBudgetTarget')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    budgets.map((b) => {
                      const spent = filtered
                        .filter((tx) => tx.type === 'expense' && tx.category === b.category)
                        .reduce((acc, tx) => acc + tx.amount, 0);
                      const pct = Math.round((spent / b.amount) * 100);
                      const isOver = pct > 100;
                      const isWarning = pct >= 75 && !isOver;
                      const barColor = isOver ? Colors.expense : isWarning ? '#FF9800' : Colors.savings;
                      const meta = getCategoryMeta(b.category);

                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={s.budgetCard}
                          onPress={() => isAdmin && handleOpenEditBudget(b)}
                          activeOpacity={isAdmin ? 0.7 : 1}
                        >
                          <View style={s.budgetTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={[s.budgetCatIconCircle, { backgroundColor: meta.bg }]}>
                                <Ionicons name={meta.icon || 'receipt-outline'} size={14} color={meta.color} />
                              </View>
                              <Text style={s.budgetCategoryName}>{b.category}</Text>
                            </View>
                            <Text style={[s.budgetStatusText, isOver && { color: Colors.expense }]}>
                              {pct}%
                            </Text>
                          </View>
                          <AnimatedProgressBar
                            progress={Math.min(pct, 100)}
                            color={barColor}
                            height={6}
                            borderRadius={3}
                            style={{ marginVertical: 6 }}
                          />
                          <View style={s.budgetBottomRow}>
                            <Text style={s.budgetSpentText}>
                              {formatRupiah(spent)} / {formatRupiah(b.amount)}
                            </Text>
                            {isAdmin && (
                              <Ionicons name="create-outline" size={14} color={Colors.primary} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Otter Mascot Motivational Card */}
              <View style={s.desktopOtterCard}>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <OtterMascot
                    variant={balance > 0 ? 'happy' : balance < 0 ? 'crying' : 'thinking'}
                    size="md"
                  />
                </View>
                <Text style={s.desktopOtterTitle}>Evaluasi Finansial Otter</Text>
                <Text style={s.desktopOtterText}>
                  {balance > 0
                    ? '"Hebat! Keuangan bulan ini surplus. Pertahankan kebiasaan menabung keluarga ya!"'
                    : balance < 0
                    ? '"Ada sedikit defisit pengeluaran dibanding pemasukan. Yuk periksa pos anggaran belanja!"'
                    : '"Pemasukan dan pengeluaran seimbang. Coba cari celah untuk menambah porsi tabungan."'}
                </Text>
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* HEADER */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerTopRow}>
            <Text style={s.headerTitle}>{t('statsTitle')}</Text>
            {activeWorkspace && (
              <View style={s.wsBadge}>
                <Text style={s.wsBadgeText}>{activeWorkspace.name}</Text>
              </View>
            )}
          </View>

          {/* Calendar Dropdown Button (replaces month pills) */}
          <TouchableOpacity
            style={s.calendarDropdownBtn}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={16} color="#fff" />
            <Text style={s.calendarDropdownText}>{dateFilter.label}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* BODY */}
        <View style={s.body}>
          {/* Summary Cards Row */}
          <Animated.View entering={FadeInDown.duration(450)} style={s.summaryCardRow}>
            <View style={[s.summaryCard, s.summaryCardIncome]}>
              <View style={s.summaryCardHeader}>
                <View style={[s.summaryDot, { backgroundColor: Colors.incomeSoft }]}>
                  <Ionicons name="arrow-up-circle-outline" size={20} color={Colors.income} />
                </View>
                <Text style={[s.summaryCardLabel, { color: Colors.income }]}>{t('income')}</Text>
              </View>
              <Text style={[s.summaryCardAmt, { color: Colors.income }]}>
                {formatRupiah(monthSummary.income)}
              </Text>
            </View>

            <View style={[s.summaryCard, s.summaryCardExpense]}>
              <View style={s.summaryCardHeader}>
                <View style={[s.summaryDot, { backgroundColor: Colors.expenseSoft }]}>
                  <Ionicons name="arrow-down-circle-outline" size={20} color={Colors.expense} />
                </View>
                <Text style={[s.summaryCardLabel, { color: Colors.expense }]}>{t('expense')}</Text>
              </View>
              <Text style={[s.summaryCardAmt, { color: Colors.expense }]}>
                {formatRupiah(monthSummary.expense)}
              </Text>
            </View>
          </Animated.View>

          {/* Net Balance card with Mascot */}
          <Animated.View entering={FadeInDown.delay(80).duration(450)} style={s.netCard}>
            <View style={s.netCardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.netLabel}>{t('netBalance')} — {dateFilter.label}</Text>
                <Text style={[s.netAmount, {
                  color: balance >= 0 ? '#059669' : '#DC2626',
                }]}>
                  {balance >= 0 ? '+' : ''}{formatRupiah(balance)}
                </Text>
              </View>
              <View style={s.netMascotWrap}>
                <OtterMascot
                  variant={balance > 0 ? 'happy' : balance < 0 ? 'crying' : 'thinking'}
                  size="sm"
                />
              </View>
            </View>

            {/* Income/expense comparative bar */}
            <View style={s.comparativeBarsWrap}>
              <View style={s.barHeaderRow}>
                <View style={s.barLabelGroup}>
                  <Ionicons name="arrow-up-circle-outline" size={14} color={Colors.income} />
                  <Text style={s.barLabel}>{t('income')}</Text>
                </View>
                <Text style={[s.barValue, { color: Colors.income }]}>
                  {monthSummary.income > 0
                    ? `${Math.round((monthSummary.income / Math.max(monthSummary.income, monthSummary.expense)) * 100)}%`
                    : '0%'}
                </Text>
              </View>
              <AnimatedProgressBar
                progress={monthSummary.income > 0
                  ? (monthSummary.income / Math.max(monthSummary.income, monthSummary.expense)) * 100
                  : 0}
                color={Colors.income}
                height={7}
                borderRadius={4}
              />

              <View style={[s.barHeaderRow, { marginTop: 8 }]}>
                <View style={s.barLabelGroup}>
                  <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.expense} />
                  <Text style={s.barLabel}>{t('expense')}</Text>
                </View>
                <Text style={[s.barValue, { color: Colors.expense }]}>
                  {monthSummary.expense > 0
                    ? `${Math.round((monthSummary.expense / Math.max(monthSummary.income, monthSummary.expense)) * 100)}%`
                    : '0%'}
                </Text>
              </View>
              <AnimatedProgressBar
                progress={monthSummary.expense > 0
                  ? (monthSummary.expense / Math.max(monthSummary.income, monthSummary.expense)) * 100
                  : 0}
                color={Colors.expense}
                height={7}
                borderRadius={4}
              />
            </View>
          </Animated.View>

          {/* Tab switch: pengeluaran / pemasukan kategori */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.tabSwitch}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'expense' && s.tabBtnActiveExpense]}
              onPress={() => setTab('expense')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-down-circle-outline"
                size={16}
                color={tab === 'expense' ? Colors.expense : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.tabBtnText, tab === 'expense' && s.tabBtnTextActiveExpense]}>
                {t('expense')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'income' && s.tabBtnActiveIncome]}
              onPress={() => setTab('income')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up-circle-outline"
                size={16}
                color={tab === 'income' ? Colors.income : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[s.tabBtnText, tab === 'income' && s.tabBtnTextActiveIncome]}>
                {t('income')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* COLLAPSIBLE PIE / DONUT CHART                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <Animated.View entering={FadeInDown.delay(155).duration(400)}>
            <TouchableOpacity
              style={s.pieToggleBtn}
              onPress={() => setShowPieChart(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={s.pieToggleLeft}>
                <Ionicons name="pie-chart-outline" size={18} color={Colors.primary} />
                <Text style={s.pieToggleText}>
                  {showPieChart ? t('hidePieChart') : t('showPieChart')}
                </Text>
              </View>
              <Ionicons
                name={showPieChart ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {showPieChart && (
              <Animated.View entering={FadeIn.duration(300)} style={s.pieChartWrap}>
                {pieSlices.length > 0 ? (
                  <PieChart
                    data={pieSlices}
                    total={totalForTab}
                    size={200}
                    showNegative={tab === 'expense'}
                    formatValue={(v) => formatRupiah(tab === 'expense' ? -v : v)}
                  />
                ) : (
                  <View style={s.pieEmptyWrap}>
                    <Text style={s.pieEmptyText}>{t('noDataPeriod')}</Text>
                  </View>
                )}
                <Text style={s.pieHintText}>{t('tapSliceHint')}</Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* SECTION: ANGGARAN & KUOTA (HANYA TAB PENGELUARAN) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {tab === 'expense' && (
            <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.budgetSection}>
              <View style={s.budgetHeaderRow}>
                <View>
                  <Text style={s.budgetSectionTitle}>{t('categoryBudgetLimits')}</Text>
                  <Text style={s.budgetSectionSubtitle}>{t('categoryBudgetLimitsSubtitle')}</Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={s.setBudgetBtn}
                    onPress={handleOpenAddBudget}
                  >
                    <Text style={s.setBudgetBtnText}>+ {t('setBudget')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {budgets.length === 0 ? (
                <View style={s.noBudgetBox}>
                  <Text style={s.noBudgetText}>{t('noBudgetYet')}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={handleOpenAddBudget}>
                      <Text style={s.noBudgetAction}>+ {t('setBudgetTarget')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                budgets.map(b => {
                  const spent = filtered
                    .filter(t => t.type === 'expense' && t.category === b.category)
                    .reduce((acc, t) => acc + t.amount, 0);
                  const pct = Math.round((spent / b.amount) * 100);
                  const isOver = pct > 100;
                  const isWarning = pct >= 75 && !isOver;
                  const barColor = isOver ? Colors.expense : isWarning ? '#FF9800' : Colors.savings;
                  const catMeta = getCategoryMeta(b.category);

                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={s.budgetCard}
                      onPress={() => handleOpenEditBudget(b)}
                      disabled={!isAdmin}
                      activeOpacity={0.7}
                    >
                      <View style={s.budgetTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[s.budgetCatIconCircle, { backgroundColor: catMeta.bg }]}>
                            <Ionicons name={catMeta.icon || 'receipt-outline'} size={15} color={catMeta.color} />
                          </View>
                          <Text style={s.budgetCategoryName}>{b.category}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[s.budgetStatusBadge, { backgroundColor: isOver ? Colors.expenseSoft : isWarning ? '#FFF3E0' : Colors.savingsSoft }]}>
                            <Text style={[s.budgetStatusText, { color: barColor }]}>
                              {isOver ? `${t('budgetOverbudget')} (+${pct - 100}%)` : `${pct}%`}
                            </Text>
                          </View>
                          {isAdmin && (
                            <View style={s.budgetEditAffordance}>
                              <Ionicons name="create-outline" size={14} color={Colors.primary} />
                            </View>
                          )}
                        </View>
                      </View>
                      <AnimatedProgressBar
                        progress={Math.min(pct, 100)}
                        color={barColor}
                        height={6}
                        borderRadius={3}
                        style={{ marginTop: 8 }}
                      />
                      <View style={s.budgetBottomRow}>
                        <Text style={s.budgetSpentText}>{t('budgetSpent')}: {formatRupiah(spent)}</Text>
                        <Text style={s.budgetTotalText}>{t('budgetQuota')}: {formatRupiah(b.amount)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </Animated.View>
          )}

          {/* Category breakdown */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('byCategory')}</Text>
            <Text style={s.sectionSub}>{dateFilter.label}</Text>
          </View>

          {loadingTx ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : byCategory.length === 0 ? (
            <EmptyState
              mascot="thinking"
              title={language === 'id' ? 'Belum Ada Transaksi' : 'No Transactions Yet'}
              subtitle={
                language === 'id'
                  ? `Tidak ada ${tab === 'expense' ? 'pengeluaran' : 'pemasukan'} pada periode ${dateFilter.label}.`
                  : `No ${tab === 'expense' ? 'expenses' : 'income'} recorded in ${dateFilter.label}.`
              }
              compact
            />
          ) : (
            byCategory.map(([cat, amount], index) => {
              const meta = getCategoryMeta(cat);
              const pct = totalForTab > 0 ? Math.round((amount / totalForTab) * 100) : 0;
              return (
                <Animated.View
                  key={cat}
                  entering={FadeInUp.delay(index * 60).duration(350)}
                  style={s.catCard}
                >
                  <View style={[s.catIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon || 'receipt-outline'} size={22} color={meta.color} />
                  </View>
                  <View style={s.catMid}>
                    <View style={s.catNameRow}>
                      <Text style={s.catName}>{cat}</Text>
                      <Text style={[s.catPct, { color: meta.color }]}>{pct}%</Text>
                    </View>
                    <AnimatedProgressBar
                      progress={pct}
                      color={meta.color}
                      height={5}
                      borderRadius={3}
                      style={{ marginTop: 6 }}
                    />
                    <Text style={s.catAmt}>{formatRupiah(amount)}</Text>
                  </View>
                </Animated.View>
              );
            })
          )}
        </View>
      </ScrollView>

      {modals}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7FAFC' },
  header: {
    backgroundColor: Colors.forestGreen,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  wsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  wsBadgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  monthScrollContent: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
    paddingRight: 16,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  monthPillActive: { backgroundColor: '#fff' },
  monthPillText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  monthPillTextActive: { color: Colors.primary, fontWeight: '700' },

  body: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  summaryCardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    ...Shadows.card,
  },
  summaryCardIncome: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  summaryCardExpense: {
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCardAmt: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },

  netCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  netCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netMascotWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  netAmount: {
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  comparativeBarsWrap: {
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  barHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    fontSize: 12,
    color: Colors.textDark,
    fontWeight: '600',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '800',
  },

  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  tabBtnActiveExpense: {
    backgroundColor: Colors.expenseSoft,
    borderWidth: 1.5,
    borderColor: Colors.expense,
    ...Shadows.card,
  },
  tabBtnTextActiveExpense: {
    color: Colors.expense,
    fontWeight: '800',
  },
  tabBtnActiveIncome: {
    backgroundColor: Colors.incomeSoft,
    borderWidth: 1.5,
    borderColor: Colors.income,
    ...Shadows.card,
  },
  tabBtnTextActiveIncome: {
    color: Colors.income,
    fontWeight: '800',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
  },
  sectionSub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    ...Shadows.card,
  },
  catIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catMid: { flex: 1, gap: 2 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  catPct: { fontSize: 14, fontWeight: '800' },
  catAmt: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // ── Budget Section ─────────────────────────────────────────────────────────
  budgetSection: {
    marginTop: 6,
    marginBottom: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
    gap: 12,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  budgetSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  budgetSectionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  setBudgetBtn: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  setBudgetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  noBudgetBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  noBudgetText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  noBudgetAction: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  budgetCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCatIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetEditAffordance: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCategoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textDark,
  },
  budgetStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  budgetStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  budgetSpentText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  budgetTotalText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // ── Modal Budget ────────────────────────────────────────────────────────────
  inputSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 6,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickAmountBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickAmountBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.expenseSoft,
    borderWidth: 1,
    borderColor: '#FFD7DB',
    marginTop: 4,
  },
  deleteBudgetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.expense,
  },
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
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textDark,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
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
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: 8,
    backgroundColor: Colors.background,
  },
  catChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  catChipText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },

  // ── Calendar Dropdown Button ────────────────────────────────────────────
  calendarDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: 14,
  },
  calendarDropdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Pie Chart Collapsible ──────────────────────────────────────────────
  pieToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    ...Shadows.card,
  },
  pieToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pieToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  pieChartWrap: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    ...Shadows.card,
  },
  pieEmptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  pieEmptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pieHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
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
  desktopTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F3832',
    letterSpacing: -0.3,
  },
  desktopSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  desktopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  desktopWsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F8F5',
    borderWidth: 1,
    borderColor: '#C3EBE3',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  desktopWsPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3832',
  },
  desktopCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  desktopCalendarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F3832',
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
  desktopKpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desktopKpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  desktopKpiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  desktopKpiAmt: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  desktopKpiSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  desktopKpiCardPrimary: {
    flex: 1.25,
    backgroundColor: '#0F3832',
    borderRadius: Radius.xl,
    padding: 20,
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  desktopKpiLabelLight: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
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
  desktopKpiAmtLight: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  desktopBadgeGreen: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,168,107,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  desktopBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27C93F',
  },
  desktopContentGrid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  desktopLeftCol: {
    flex: 1.5,
    gap: 18,
  },
  desktopCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  desktopCardBoxTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F3832',
    marginBottom: 14,
  },
  desktopRightCol: {
    flex: 1,
    gap: 18,
  },
  desktopOtterCard: {
    backgroundColor: '#E6F7F2',
    borderRadius: Radius.xl,
    padding: 22,
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
  },
});
