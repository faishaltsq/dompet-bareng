import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { useWorkspace } from '@/context/WorkspaceContext';
import { formatRupiah, getCategoryMeta, EXPENSE_CATEGORIES } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedProgressBar } from '@/components/Animated';
import SwipeableModal from '@/components/SwipeableModal';
import { useLanguage } from '@/context/LanguageContext';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TabType = 'expense' | 'income';

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const MONTHS = language === 'id' ? MONTHS_ID : MONTHS_EN;
  const { activeWorkspace, transactions, loadingTx, budgets, setBudget, deleteBudget } = useWorkspace();
  const isAdmin = activeWorkspace?.role === 'admin';
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0] as string);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [tab, setTab] = useState<TabType>('expense');

  const filtered = useMemo(() => {
    if (!activeWorkspace) return [];
    return transactions
      .filter(t => t.workspace_id === activeWorkspace.id)
      .filter(t => {
        const d = new Date(t.transaction_date);
        return d.getMonth() === selectedMonth && d.getFullYear() === new Date().getFullYear();
      });
  }, [transactions, selectedMonth, activeWorkspace]);

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

  const handleSaveBudget = async () => {
    const raw = budgetAmount.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    if (!num || num <= 0) return;
    setSavingBudget(true);
    await setBudget(budgetCategory, num);
    setSavingBudget(false);
    setBudgetModalVisible(false);
    setBudgetAmount('');
  };

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

          {/* Month Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.monthScrollContent}
          >
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[s.monthPill, i === selectedMonth && s.monthPillActive]}
                onPress={() => setSelectedMonth(i)}
              >
                <Text style={[s.monthPillText, i === selectedMonth && s.monthPillTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* BODY */}
        <View style={s.body}>
          {/* Summary Cards Row */}
          <Animated.View entering={FadeInDown.duration(450)} style={s.summaryCardRow}>
            <View style={[s.summaryCard, { borderColor: Colors.income }]}>
              <View style={[s.summaryDot, { backgroundColor: Colors.incomeSoft }]}>
                <Text style={{ fontSize: 16 }}>⬆️</Text>
              </View>
              <Text style={s.summaryCardLabel}>{t('income')}</Text>
              <Text style={[s.summaryCardAmt, { color: Colors.income }]}>
                {formatRupiah(monthSummary.income)}
              </Text>
            </View>

            <View style={[s.summaryCard, { borderColor: Colors.expense }]}>
              <View style={[s.summaryDot, { backgroundColor: Colors.expenseSoft }]}>
                <Text style={{ fontSize: 16 }}>⬇️</Text>
              </View>
              <Text style={s.summaryCardLabel}>{t('expense')}</Text>
              <Text style={[s.summaryCardAmt, { color: Colors.expense }]}>
                {formatRupiah(monthSummary.expense)}
              </Text>
            </View>
          </Animated.View>

          {/* Net Balance card */}
          <Animated.View entering={FadeInDown.delay(80).duration(450)} style={s.netCard}>
            <View>
              <Text style={s.netLabel}>{t('netBalance')} {MONTHS[selectedMonth]}</Text>
              <Text style={[s.netAmount, {
                color: balance >= 0 ? Colors.income : Colors.expense,
              }]}>
                {balance >= 0 ? '+' : ''}{formatRupiah(balance)}
              </Text>
            </View>

            {/* Income/expense comparative bar */}
            <View style={{ gap: 6, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.barLabel}>{t('income')}</Text>
                <Text style={[s.barLabel, { color: Colors.income }]}>
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
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={s.barLabel}>{t('expense')}</Text>
                <Text style={[s.barLabel, { color: Colors.expense }]}>
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
              />
            </View>
          </Animated.View>

          {/* Tab switch: pengeluaran / pemasukan kategori */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={s.tabSwitch}>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'expense' && s.tabBtnActive]}
              onPress={() => setTab('expense')}
            >
              <Text style={[s.tabBtnText, tab === 'expense' && s.tabBtnTextActive]}>{t('expense')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, tab === 'income' && s.tabBtnActive]}
              onPress={() => setTab('income')}
            >
              <Text style={[s.tabBtnText, tab === 'income' && s.tabBtnTextActive]}>{t('income')}</Text>
            </TouchableOpacity>
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
                    onPress={() => setBudgetModalVisible(true)}
                  >
                    <Text style={s.setBudgetBtnText}>+ {t('setBudget')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {budgets.length === 0 ? (
                <View style={s.noBudgetBox}>
                  <Text style={s.noBudgetText}>{t('noBudgetYet')}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => setBudgetModalVisible(true)}>
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

                  return (
                    <View key={b.id} style={s.budgetCard}>
                      <View style={s.budgetTopRow}>
                        <Text style={s.budgetCategoryName}>{b.category}</Text>
                        <View style={[s.budgetStatusBadge, { backgroundColor: isOver ? Colors.expenseSoft : isWarning ? '#FFF3E0' : Colors.savingsSoft }]}>
                          <Text style={[s.budgetStatusText, { color: barColor }]}>
                            {isOver ? `Overbudget (+${pct - 100}%)` : `${pct}%`}
                          </Text>
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
                    </View>
                  );
                })
              )}
            </Animated.View>
          )}

          {/* Category breakdown */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('byCategory')}</Text>
            <Text style={s.sectionSub}>{MONTHS[selectedMonth]}</Text>
          </View>

          {loadingTx ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : byCategory.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={s.emptyWrap}>
              <Text style={{ fontSize: 36 }}>📊</Text>
              <Text style={s.emptyText}>
                {language === 'id'
                  ? `Tidak ada ${tab === 'expense' ? 'pengeluaran' : 'pemasukan'} di ${MONTHS[selectedMonth]}.`
                  : `No ${tab === 'expense' ? 'expenses' : 'income'} recorded in ${MONTHS[selectedMonth]}.`}
              </Text>
            </Animated.View>
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
                    <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
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

      {/* MODAL ATUR ANGGARAN */}
      <SwipeableModal
        visible={budgetModalVisible}
        onClose={() => setBudgetModalVisible(false)}
      >
        <Text style={s.sheetTitle}>{t('setBudgetTitle')}</Text>
        <Text style={s.sheetSubtitle}>{t('setBudgetSubtitle')}</Text>

        {/* Category horizontal scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {EXPENSE_CATEGORIES.map(cat => {
            const isSelected = budgetCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[s.catChip, isSelected && s.catChipActive]}
                onPress={() => setBudgetCategory(cat)}
              >
                <Text style={[s.catChipText, isSelected && s.catChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={s.sheetInput}
          value={budgetAmount}
          onChangeText={setBudgetAmount}
          placeholder={t('budgetPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={[s.sheetBtn, savingBudget && { opacity: 0.6 }]}
          onPress={handleSaveBudget}
          disabled={savingBudget}
        >
          {savingBudget ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sheetBtnText}>{t('saveBudgetBtn')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setBudgetModalVisible(false)} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </SwipeableModal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
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
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  summaryCardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1.5,
    gap: 6,
    ...Shadows.card,
  },
  summaryDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  summaryCardAmt: {
    fontSize: 14,
    fontWeight: '800',
  },

  netCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
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
  barLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  tabBtnActive: {
    backgroundColor: Colors.card,
    ...Shadows.card,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
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

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Budget Section ─────────────────────────────────────────────────────────
  budgetSection: {
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
    gap: 10,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
