import { describe, it, expect } from 'vitest';
import { createDuplicateDraft } from '@/lib/transactionDuplicate';

describe('transactionDuplicate', () => {
  it('creates draft pre-filled with source attributes and current date', () => {
    const source = {
      type: 'expense' as const,
      amount: 45000,
      category: 'Transport',
      description: 'Bensin motor',
      transaction_date: '2026-01-15', // historical date
    };

    const draft = createDuplicateDraft(source, '2026-10-30');

    expect(draft.type).toBe('expense');
    expect(draft.amount).toBe(45000);
    expect(draft.amountInput).toBe('45000');
    expect(draft.category).toBe('Transport');
    expect(draft.description).toBe('Bensin motor');
    // Crucial requirement: date resets to today, NOT historical date
    expect(draft.transaction_date).toBe('2026-10-30');
  });

  it('handles null description by defaulting to empty string', () => {
    const source = {
      type: 'income' as const,
      amount: 500000,
      category: 'Bonus',
      description: null,
    };

    const draft = createDuplicateDraft(source, '2026-10-30');
    expect(draft.description).toBe('');
  });
});
