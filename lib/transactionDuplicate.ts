export interface SourceTransaction {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string | null;
  transaction_date?: string;
}

export interface DuplicatedTransactionDraft {
  type: 'income' | 'expense';
  amount: number;
  amountInput: string;
  category: string;
  description: string;
  transaction_date: string;
}

export function createDuplicateDraft(
  source: SourceTransaction,
  todayDate?: string
): DuplicatedTransactionDraft {
  const dateStr = todayDate || new Date().toISOString().split('T')[0];

  return {
    type: source.type,
    amount: source.amount,
    amountInput: String(source.amount),
    category: source.category,
    description: source.description || '',
    transaction_date: dateStr,
  };
}
