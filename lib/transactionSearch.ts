export interface TransactionSearchFilter {
  query?: string;
  type?: 'all' | 'income' | 'expense';
  category?: string;
}

export function filterTransactions<
  T extends {
    description?: string | null;
    category?: string;
    amount: number;
    type: string;
  }
>(transactions: T[], filter: TransactionSearchFilter): T[] {
  if (!transactions || transactions.length === 0) return [];

  const rawQuery = (filter.query || '').trim().toLowerCase();
  const targetType = filter.type && filter.type !== 'all' ? filter.type : null;
  const targetCategory = (filter.category || '').trim().toLowerCase();

  return transactions.filter((tx) => {
    // 1. Type check
    if (targetType && tx.type !== targetType) {
      return false;
    }

    // 2. Category check if specified
    if (targetCategory && (tx.category || '').toLowerCase() !== targetCategory) {
      return false;
    }

    // 3. Text query check
    if (!rawQuery) {
      return true;
    }

    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category || '').toLowerCase();
    const amtStr = String(tx.amount);

    return (
      desc.includes(rawQuery) ||
      cat.includes(rawQuery) ||
      amtStr.includes(rawQuery)
    );
  });
}
