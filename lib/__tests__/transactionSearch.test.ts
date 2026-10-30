import { describe, it, expect } from 'vitest';
import { filterTransactions } from '@/lib/transactionSearch';

describe('transactionSearch', () => {
  const sampleTransactions = [
    { id: '1', description: 'Kopi Kenangan', category: 'Makanan & Minuman', amount: 25000, type: 'expense' },
    { id: '2', description: 'Gaji Bulanan', category: 'Gaji', amount: 10000000, type: 'income' },
    { id: '3', description: 'Listrik PLN', category: 'Tagihan', amount: 350000, type: 'expense' },
    { id: '4', description: null, category: 'Lainnya', amount: 50000, type: 'expense' },
  ];

  it('filters transactions by case-insensitive description query', () => {
    const result = filterTransactions(sampleTransactions, { query: 'kopi' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters transactions by category name query', () => {
    const result = filterTransactions(sampleTransactions, { query: 'Tagihan' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters transactions by numeric amount query', () => {
    const result = filterTransactions(sampleTransactions, { query: '350000' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters transactions by type (income / expense)', () => {
    const result = filterTransactions(sampleTransactions, { type: 'income' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('combines text query and type filter', () => {
    const result = filterTransactions(sampleTransactions, { query: 'kenangan', type: 'expense' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns all items when filter is empty or whitespace', () => {
    const result = filterTransactions(sampleTransactions, { query: '   ', type: 'all' });
    expect(result).toHaveLength(4);
  });
});
