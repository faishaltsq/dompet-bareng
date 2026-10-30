import { type OtterVariant } from '@/components/OtterMascot';

export interface TransactionItem {
  id: string;
  transaction_date: string;
  type: string;
  amount: number;
  category: string;
  description?: string | null;
}

export interface MonthlyRecapResult {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePercent: number;
  topExpenseCategory: { category: string; amount: number } | null;
  mascotMood: OtterVariant;
  headline: string;
}

export function generateMonthlyRecap(
  transactions: TransactionItem[],
  targetYear: number,
  targetMonth: number // 1-12
): MonthlyRecapResult {
  const monthTransactions = transactions.filter((tx) => {
    const parts = tx.transaction_date.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    return y === targetYear && m === targetMonth;
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of monthTransactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount;
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    }
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRatePercent =
    totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  let topExpenseCategory: { category: string; amount: number } | null = null;
  for (const [cat, amt] of Object.entries(categoryTotals)) {
    if (!topExpenseCategory || amt > topExpenseCategory.amount) {
      topExpenseCategory = { category: cat, amount: amt };
    }
  }

  let mascotMood: OtterVariant = 'happy';
  let headline = 'Keuangan bulan ini terkendali dengan baik!';

  if (netSavings > 0 && savingsRatePercent >= 20) {
    mascotMood = 'rich';
    headline = `Luar biasa! Kamu berhasil menghemat ${savingsRatePercent}% dari total pemasukan.`;
  } else if (netSavings >= 0) {
    mascotMood = 'happy';
    headline = 'Bagus! Arus kas bulan ini seimbang dan surplus.';
  } else if (totalExpense > totalIncome * 1.5) {
    mascotMood = 'panic';
    headline = 'Perhatian! Pengeluaran melebihi 150% pemasukan bulan ini.';
  } else {
    mascotMood = 'warning';
    headline = 'Pengeluaran melebihi pemasukan. Waktunya evaluasi anggaran.';
  }

  return {
    year: targetYear,
    month: targetMonth,
    totalIncome,
    totalExpense,
    netSavings,
    savingsRatePercent,
    topExpenseCategory,
    mascotMood,
    headline,
  };
}
