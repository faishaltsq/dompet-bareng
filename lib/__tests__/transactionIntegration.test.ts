import { describe, it, expect } from 'vitest';
import { filterTransactions } from '@/lib/transactionSearch';
import { createDuplicateDraft } from '@/lib/transactionDuplicate';
import { generateTransactionsCsv } from '@/lib/exportCsv';

describe('Transaction Integration and Flows', () => {
  const dataset = [
    {
      id: 'tx-1',
      description: 'Gojek ke Kantor',
      category: 'Transport',
      amount: 18000,
      type: 'expense' as const,
      transaction_date: '2026-10-25',
    },
    {
      id: 'tx-2',
      description: 'GrabFood Soto Betawi',
      category: 'Makanan & Minuman',
      amount: 45000,
      type: 'expense' as const,
      transaction_date: '2026-10-28',
    },
    {
      id: 'tx-3',
      description: 'Bonus Kinerja Q3',
      category: 'Bonus',
      amount: 1500000,
      type: 'income' as const,
      transaction_date: '2026-10-30',
    },
  ];

  it('searches and filters transactions accurately', () => {
    const searchGrab = filterTransactions(dataset, { query: 'GrabFood' });
    expect(searchGrab).toHaveLength(1);
    expect(searchGrab[0].id).toBe('tx-2');

    const expensesOnly = filterTransactions(dataset, { type: 'expense' });
    expect(expensesOnly).toHaveLength(2);
  });

  it('creates duplicate draft with today date for seamless modal pre-fill', () => {
    const target = dataset[1];
    const draft = createDuplicateDraft(target, '2026-10-30');

    expect(draft.type).toBe('expense');
    expect(draft.amount).toBe(45000);
    expect(draft.amountInput).toBe('45000');
    expect(draft.category).toBe('Makanan & Minuman');
    expect(draft.description).toBe('GrabFood Soto Betawi');
    expect(draft.transaction_date).toBe('2026-10-30');
  });

  it('generates exportable CSV from filtered transactions', () => {
    const csv = generateTransactionsCsv(dataset);
    expect(csv).toContain('Tanggal,Tipe,Kategori,Nominal,Deskripsi');
    expect(csv).toContain('2026-10-25,Pengeluaran,Transport,18000,Gojek ke Kantor');
    expect(csv).toContain('2026-10-30,Pemasukan,Bonus,1500000,Bonus Kinerja Q3');
  });
});
