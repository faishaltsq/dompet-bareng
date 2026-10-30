import { describe, it, expect } from 'vitest';
import { generateMonthlyRecap, type TransactionItem } from '@/lib/monthlyRecap';
import { generateActionableInsights } from '@/lib/actionableInsights';

describe('monthlyRecap and actionableInsights', () => {
  const transactions: TransactionItem[] = [
    // Sept 2026
    { id: '1', transaction_date: '2026-09-05', type: 'income', amount: 8000000, category: 'Gaji' },
    { id: '2', transaction_date: '2026-09-10', type: 'expense', amount: 1000000, category: 'Makanan & Minuman' },
    { id: '3', transaction_date: '2026-09-15', type: 'expense', amount: 500000, category: 'Transport' },

    // Oct 2026
    { id: '4', transaction_date: '2026-10-01', type: 'income', amount: 8000000, category: 'Gaji' },
    { id: '5', transaction_date: '2026-10-10', type: 'expense', amount: 1500000, category: 'Makanan & Minuman' }, // +50% increase
    { id: '6', transaction_date: '2026-10-15', type: 'expense', amount: 500000, category: 'Transport' },
    { id: '7', transaction_date: '2026-10-20', type: 'expense', amount: 350000, category: 'Tagihan' },
  ];

  describe('generateMonthlyRecap', () => {
    it('computes accurate totals, top category, and mascot mood', () => {
      const recap = generateMonthlyRecap(transactions, 2026, 10);
      expect(recap.totalIncome).toBe(8000000);
      expect(recap.totalExpense).toBe(2350000);
      expect(recap.netSavings).toBe(5650000);
      expect(recap.savingsRatePercent).toBe(71);
      expect(recap.topExpenseCategory?.category).toBe('Makanan & Minuman');
      expect(recap.topExpenseCategory?.amount).toBe(1500000);
      expect(recap.mascotMood).toBe('rich');
    });

    it('assigns warning/panic mood if expenses exceed income', () => {
      const deficitTx: TransactionItem[] = [
        { id: '1', transaction_date: '2026-10-01', type: 'income', amount: 1000000, category: 'Gaji' },
        { id: '2', transaction_date: '2026-10-05', type: 'expense', amount: 2000000, category: 'Sewa' },
      ];
      const recap = generateMonthlyRecap(deficitTx, 2026, 10);
      expect(recap.netSavings).toBe(-1000000);
      expect(recap.mascotMood).toBe('panic');
    });
  });

  describe('generateActionableInsights', () => {
    it('identifies categories with significant cost increases', () => {
      const insights = generateActionableInsights(transactions, 2026, 10);
      expect(insights.length).toBeGreaterThan(0);
      const foodInsight = insights.find((i) => i.category === 'Makanan & Minuman');
      expect(foodInsight).toBeDefined();
      expect(foodInsight?.increasePercent).toBe(50);
      expect(foodInsight?.suggestedAction).toBe('filter_category');
    });
  });
});
