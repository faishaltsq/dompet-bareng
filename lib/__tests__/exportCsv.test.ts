import { describe, it, expect } from 'vitest';
import { generateTransactionsCsv } from '@/lib/exportCsv';

describe('exportCsv', () => {
  it('generates standard CSV with header and sanitized values', () => {
    const records = [
      {
        transaction_date: '2026-10-30',
        type: 'expense',
        category: 'Makanan & Minuman',
        amount: 35000,
        description: 'Makan siang, soto ayam',
      },
      {
        transaction_date: '2026-10-29',
        type: 'income',
        category: 'Gaji',
        amount: 8000000,
        description: 'Gaji "Pokok"',
      },
    ];

    const csv = generateTransactionsCsv(records);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Tanggal,Tipe,Kategori,Nominal,Deskripsi');
    expect(lines[1]).toBe('2026-10-30,Pengeluaran,Makanan & Minuman,35000,"Makan siang, soto ayam"');
    expect(lines[2]).toBe('2026-10-29,Pemasukan,Gaji,8000000,"Gaji ""Pokok"""');
  });

  it('handles null descriptions and empty transactions array', () => {
    const csv = generateTransactionsCsv([]);
    expect(csv).toBe('Tanggal,Tipe,Kategori,Nominal,Deskripsi');
  });
});
