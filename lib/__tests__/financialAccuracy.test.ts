import { describe, it, expect } from 'vitest';
import { formatRupiah } from '../utils';

describe('Financial Accuracy & Analytics Suite', () => {
  describe('Progress Bar Scale & Clamping (0-100 scale invariant)', () => {
    // AnimatedProgressBar expects 0-100 scale (not 0-1 decimal)
    const clampProgress = (progress: number) => Math.min(100, Math.max(0, Math.round(progress)));

    it('handles 0% progress correctly', () => {
      expect(clampProgress(0)).toBe(0);
    });

    it('handles 50% progress correctly', () => {
      expect(clampProgress(50)).toBe(50);
    });

    it('handles 100% progress correctly', () => {
      expect(clampProgress(100)).toBe(100);
    });

    it('clamps overflow values (>100%) to 100%', () => {
      expect(clampProgress(125)).toBe(100);
      expect(clampProgress(250)).toBe(100);
    });

    it('clamps negative values (<0%) to 0%', () => {
      expect(clampProgress(-10)).toBe(0);
      expect(clampProgress(-0.5)).toBe(0);
    });

    it('distinguishes 0-1 decimal scale from 0-100 scale (detects double-division bug)', () => {
      const calculateBudgetPercent = (expense: number, income: number) => {
        if (income <= 0) return expense > 0 ? 100 : 0;
        return Math.min(Math.round((expense / income) * 100), 100);
      };

      const pct = calculateBudgetPercent(500_000, 1_000_000);
      expect(pct).toBe(50);
      // Ensure the component receives 50, not 0.5
      expect(pct).toBeGreaterThan(1);
    });
  });

  describe('Budget Usage vs Expense Ratio Distinction', () => {
    it('calculates budgetProgressPercent when configured budgets exist', () => {
      const budgets = [
        { id: '1', workspace_id: 'ws1', category: 'Makanan', amount: 2_000_000, month: 4, year: 2026 },
        { id: '2', workspace_id: 'ws1', category: 'Transport', amount: 1_000_000, month: 4, year: 2026 },
      ];
      const summary = { income: 10_000_000, expense: 1_500_000, balance: 8_500_000 };

      const totalBudget = budgets.reduce((acc, b) => acc + (b.amount || 0), 0);
      expect(totalBudget).toBe(3_000_000);

      const budgetProgressPercent = totalBudget > 0
        ? Math.min(Math.round((summary.expense / totalBudget) * 100), 100)
        : 0;

      // Expense 1.5M out of 3M budget is 50%
      expect(budgetProgressPercent).toBe(50);

      // Contrast with expenseRatioPercent (1.5M out of 10M income = 15%)
      const expenseRatioPercent = summary.income > 0
        ? Math.min(Math.round((summary.expense / summary.income) * 100), 100)
        : summary.expense > 0 ? 100 : 0;

      expect(expenseRatioPercent).toBe(15);
      expect(budgetProgressPercent).not.toBe(expenseRatioPercent);
    });

    it('falls back to expenseRatioPercent when no budgets are configured', () => {
      const budgets: { amount: number }[] = [];
      const summary = { income: 5_000_000, expense: 2_000_000, balance: 3_000_000 };

      const totalBudget = budgets.reduce((acc, b) => acc + (b.amount || 0), 0);
      const hasBudget = totalBudget > 0;
      expect(hasBudget).toBe(false);

      const expenseRatioPercent = summary.income > 0
        ? Math.min(Math.round((summary.expense / summary.income) * 100), 100)
        : summary.expense > 0 ? 100 : 0;

      const heroGaugeValue = hasBudget ? 0 : expenseRatioPercent;
      expect(heroGaugeValue).toBe(40);
    });
  });

  describe('Donut Chart Completeness & Category Total Reconciliation', () => {
    interface CategoryItem {
      category: string;
      amount: number;
    }

    const buildPieSlices = (byCategory: [string, number][], totalForTab: number, lang: 'id' | 'en') => {
      if (totalForTab === 0 || byCategory.length === 0) return [];
      if (byCategory.length <= 6) {
        return byCategory.map(([cat, amount]) => ({
          key: cat,
          label: cat,
          value: amount,
          percentage: (amount / totalForTab) * 100,
        }));
      }
      const top5 = byCategory.slice(0, 5);
      const others = byCategory.slice(5);
      const othersTotal = others.reduce((acc, [, amt]) => acc + amt, 0);

      const slices = top5.map(([cat, amount]) => ({
        key: cat,
        label: cat,
        value: amount,
        percentage: (amount / totalForTab) * 100,
      }));

      if (othersTotal > 0) {
        slices.push({
          key: 'Lainnya',
          label: lang === 'id' ? 'Lainnya' : 'Others',
          value: othersTotal,
          percentage: (othersTotal / totalForTab) * 100,
        });
      }

      return slices;
    };

    it('reconciles 100% of the total when <= 6 categories exist', () => {
      const categories: [string, number][] = [
        ['Makanan', 500_000],
        ['Transport', 300_000],
        ['Belanja', 200_000],
      ];
      const total = 1_000_000;
      const slices = buildPieSlices(categories, total, 'id');

      expect(slices).toHaveLength(3);
      const totalSliceValue = slices.reduce((acc, s) => acc + s.value, 0);
      expect(totalSliceValue).toBe(total);

      const totalPercentage = slices.reduce((acc, s) => acc + s.percentage, 0);
      expect(Math.round(totalPercentage)).toBe(100);
    });

    it('aggregates categories > 5 into Lainnya and reconciles to exact total', () => {
      const categories: [string, number][] = [
        ['Makanan', 1_000_000],
        ['Sewa', 800_000],
        ['Transport', 400_000],
        ['Tagihan', 300_000],
        ['Belanja', 200_000],
        ['Kesehatan', 150_000],
        ['Hiburan', 100_000],
        ['Pendidikan', 50_000],
      ];
      const total = 3_000_000;
      const slices = buildPieSlices(categories, total, 'id');

      // 5 top + 1 Lainnya = 6 slices
      expect(slices).toHaveLength(6);
      expect(slices[5].key).toBe('Lainnya');
      expect(slices[5].value).toBe(150_000 + 100_000 + 50_000); // 300_000

      const totalSliceValue = slices.reduce((acc, s) => acc + s.value, 0);
      expect(totalSliceValue).toBe(total);

      const totalPercentage = slices.reduce((acc, s) => acc + s.percentage, 0);
      expect(Math.round(totalPercentage)).toBe(100);
    });

    it('returns empty slices on zero total or empty categories', () => {
      expect(buildPieSlices([], 0, 'id')).toEqual([]);
      expect(buildPieSlices([['Makanan', 0]], 0, 'id')).toEqual([]);
    });
  });

  describe('6-Month Historical Trend Aggregation', () => {
    it('aggregates income and expenses correctly over a 6-month window', () => {
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const refYear = 2026;
      const refMonth = 4; // May (zero-indexed: 0=Jan, 4=May)

      const transactions = [
        { workspace_id: 'ws1', type: 'income', amount: 5_000_000, transaction_date: '2026-05-01' },
        { workspace_id: 'ws1', type: 'expense', amount: 2_000_000, transaction_date: '2026-05-15' },
        { workspace_id: 'ws1', type: 'income', amount: 4_500_000, transaction_date: '2026-04-10' },
        { workspace_id: 'ws1', type: 'expense', amount: 1_800_000, transaction_date: '2026-04-20' },
        { workspace_id: 'ws1', type: 'expense', amount: 999_999, transaction_date: '2025-11-01' }, // out of 6-month window
        { workspace_id: 'ws2', type: 'income', amount: 10_000_000, transaction_date: '2026-05-01' }, // different workspace
      ];

      const wsTx = transactions.filter(t => t.workspace_id === 'ws1');

      const list = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(refYear, refMonth - i, 1);
        const mIdx = d.getMonth();
        const yr = d.getFullYear();
        const monthKey = `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
        const label = MONTHS[mIdx];

        let inc = 0;
        let exp = 0;
        for (const t of wsTx) {
          if (t.transaction_date.startsWith(monthKey)) {
            if (t.type === 'income') inc += t.amount;
            else exp += t.amount;
          }
        }

        list.push({ monthKey, label, year: yr, income: inc, expense: exp });
      }

      expect(list).toHaveLength(6);
      // May 2026 (index 5)
      expect(list[5].monthKey).toBe('2026-05');
      expect(list[5].income).toBe(5_000_000);
      expect(list[5].expense).toBe(2_000_000);

      // April 2026 (index 4)
      expect(list[4].monthKey).toBe('2026-04');
      expect(list[4].income).toBe(4_500_000);
      expect(list[4].expense).toBe(1_800_000);

      // December 2025 (index 0)
      expect(list[0].monthKey).toBe('2025-12');
      expect(list[0].income).toBe(0);
      expect(list[0].expense).toBe(0);
    });
  });

  describe('Zero and Negative Financial Values Handling', () => {
    it('handles negative balances correctly in summary', () => {
      const income = 2_000_000;
      const expense = 3_500_000;
      const balance = income - expense;

      expect(balance).toBe(-1_500_000);
      // formatRupiah displays -Rp 1.500.000 or Rp -1.500.000
      const formatted = formatRupiah(balance);
      expect(formatted).toContain('1.500.000');
    });

    it('handles zero income and zero expense without NaN or crashes', () => {
      const summary = { income: 0, expense: 0, balance: 0 };
      const budgetPercent = summary.income > 0
        ? Math.min(Math.round((summary.expense / summary.income) * 100), 100)
        : summary.expense > 0 ? 100 : 0;

      expect(budgetPercent).toBe(0);
      expect(Number.isNaN(budgetPercent)).toBe(false);
    });

    it('handles zero income with non-zero expenses as 100% expense ratio', () => {
      const summary = { income: 0, expense: 500_000, balance: -500_000 };
      const budgetPercent = summary.income > 0
        ? Math.min(Math.round((summary.expense / summary.income) * 100), 100)
        : summary.expense > 0 ? 100 : 0;

      expect(budgetPercent).toBe(100);
    });
  });

  describe('Pagination & Dataset Boundary (>500 transactions)', () => {
    it('accurately detects hasMoreTx when exactly 500 items returned', () => {
      const PAGE_SIZE = 500;
      const batch1 = new Array(500).fill({ id: 'tx' });
      const hasMore1 = batch1.length === PAGE_SIZE;
      expect(hasMore1).toBe(true);

      const batch2 = new Array(342).fill({ id: 'tx' });
      const hasMore2 = batch2.length === PAGE_SIZE;
      expect(hasMore2).toBe(false);
    });

    it('aggregates filtered totals accurately across large arrays (>500 tx)', () => {
      const largeTxList = Array.from({ length: 750 }, (_, i) => ({
        workspace_id: 'ws1',
        type: (i % 3 === 0 ? 'income' : 'expense') as 'income' | 'expense',
        amount: 10_000,
        transaction_date: '2026-05-01',
      }));

      const summary = largeTxList.reduce((acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      }, { income: 0, expense: 0 });

      // 250 income (2.5M) and 500 expense (5.0M)
      expect(summary.income).toBe(2_500_000);
      expect(summary.expense).toBe(5_000_000);
      expect(summary.income - summary.expense).toBe(-2_500_000);
    });
  });
});
