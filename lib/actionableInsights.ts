import { type TransactionItem } from '@/lib/monthlyRecap';

export interface ActionableInsight {
  id: string;
  category: string;
  currentAmount: number;
  previousAmount: number;
  increasePercent: number;
  message: string;
  suggestedAction: 'filter_category';
  filterValue: string;
}

export function generateActionableInsights(
  transactions: TransactionItem[],
  targetYear: number,
  targetMonth: number // 1-12
): ActionableInsight[] {
  // Previous month calculation
  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const currentCatTotals: Record<string, number> = {};
  const prevCatTotals: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const parts = tx.transaction_date.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);

    if (y === targetYear && m === targetMonth) {
      currentCatTotals[tx.category] = (currentCatTotals[tx.category] || 0) + tx.amount;
    } else if (y === prevYear && m === prevMonth) {
      prevCatTotals[tx.category] = (prevCatTotals[tx.category] || 0) + tx.amount;
    }
  }

  const insights: ActionableInsight[] = [];

  for (const [cat, currAmt] of Object.entries(currentCatTotals)) {
    const prevAmt = prevCatTotals[cat] || 0;
    if (prevAmt > 0 && currAmt > prevAmt) {
      const diff = currAmt - prevAmt;
      const increasePercent = Math.round((diff / prevAmt) * 100);

      // Flag if increase >= 20% and at least Rp 50.000 nominal increase
      if (increasePercent >= 20 && diff >= 50000) {
        insights.push({
          id: `insight-${cat}-${targetYear}-${targetMonth}`,
          category: cat,
          currentAmount: currAmt,
          previousAmount: prevAmt,
          increasePercent,
          message: `Pengeluaran ${cat} naik ${increasePercent}% dibanding bulan lalu.`,
          suggestedAction: 'filter_category',
          filterValue: cat,
        });
      }
    }
  }

  return insights.sort((a, b) => b.increasePercent - a.increasePercent);
}
