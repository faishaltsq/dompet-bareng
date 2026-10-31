import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  isDateInPeriod,
  calculatePeriodSummary,
  type PeriodFilter,
} from '../periodFilter';

describe('periodFilter — parseLocalDate', () => {
  it('parses standard YYYY-MM-DD date string', () => {
    const parsed = parseLocalDate('2026-10-31');
    expect(parsed).toEqual({
      year: 2026,
      month: 9, // 0-indexed October
      day: 31,
      dateKey: '2026-10-31',
    });
  });

  it('parses ISO date timestamp safely', () => {
    const parsed = parseLocalDate('2026-10-28T14:30:00.000Z');
    expect(parsed).toEqual({
      year: 2026,
      month: 9,
      day: 28,
      dateKey: '2026-10-28',
    });
  });

  it('returns null on invalid or empty string', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('invalid-date')).toBeNull();
  });
});

describe('periodFilter — isDateInPeriod', () => {
  // Reference date: Saturday, October 31, 2026
  const refSaturday = new Date(2026, 9, 31, 14, 0, 0);

  it('handles "all" filter', () => {
    expect(isDateInPeriod('2025-01-01', 'all', refSaturday)).toBe(true);
    expect(isDateInPeriod('2026-10-31', 'all', refSaturday)).toBe(true);
  });

  it('handles "day" (Hari Ini) filter', () => {
    expect(isDateInPeriod('2026-10-31', 'day', refSaturday)).toBe(true);
    expect(isDateInPeriod('2026-10-30', 'day', refSaturday)).toBe(false);
    expect(isDateInPeriod('2026-11-01', 'day', refSaturday)).toBe(false);
  });

  it('handles "month" (Bulan Ini) filter', () => {
    expect(isDateInPeriod('2026-10-01', 'month', refSaturday)).toBe(true);
    expect(isDateInPeriod('2026-10-15', 'month', refSaturday)).toBe(true);
    expect(isDateInPeriod('2026-10-31', 'month', refSaturday)).toBe(true);
    expect(isDateInPeriod('2026-09-30', 'month', refSaturday)).toBe(false);
    expect(isDateInPeriod('2026-11-01', 'month', refSaturday)).toBe(false);
  });

  it('handles "week" (Minggu Ini) filter on Saturday', () => {
    // Current week: Monday Oct 26 to Sunday Nov 1
    expect(isDateInPeriod('2026-10-26', 'week', refSaturday)).toBe(true); // Monday
    expect(isDateInPeriod('2026-10-28', 'week', refSaturday)).toBe(true); // Wednesday
    expect(isDateInPeriod('2026-10-30', 'week', refSaturday)).toBe(true); // Friday
    expect(isDateInPeriod('2026-10-31', 'week', refSaturday)).toBe(true); // Saturday
    expect(isDateInPeriod('2026-11-01', 'week', refSaturday)).toBe(true); // Sunday
    expect(isDateInPeriod('2026-10-25', 'week', refSaturday)).toBe(false); // Previous Sunday
    expect(isDateInPeriod('2026-11-02', 'week', refSaturday)).toBe(false); // Next Monday
  });

  it('handles "week" (Minggu Ini) filter when reference date is Monday', () => {
    // Reference: Monday, Oct 26, 2026
    const refMonday = new Date(2026, 9, 26, 9, 0, 0);
    expect(isDateInPeriod('2026-10-26', 'week', refMonday)).toBe(true);
    expect(isDateInPeriod('2026-10-31', 'week', refMonday)).toBe(true);
    expect(isDateInPeriod('2026-11-01', 'week', refMonday)).toBe(true);
    expect(isDateInPeriod('2026-10-25', 'week', refMonday)).toBe(false);
  });

  it('handles "week" (Minggu Ini) filter when reference date is Sunday', () => {
    // Reference: Sunday, Nov 1, 2026
    const refSunday = new Date(2026, 10, 1, 20, 0, 0);
    expect(isDateInPeriod('2026-10-26', 'week', refSunday)).toBe(true);
    expect(isDateInPeriod('2026-11-01', 'week', refSunday)).toBe(true);
    expect(isDateInPeriod('2026-10-25', 'week', refSunday)).toBe(false);
    expect(isDateInPeriod('2026-11-02', 'week', refSunday)).toBe(false);
  });
});

describe('periodFilter — calculatePeriodSummary', () => {
  it('correctly aggregates income, expense, balance, and count', () => {
    const txs = [
      { type: 'income', amount: 5000000 },
      { type: 'income', amount: 971000 },
      { type: 'expense', amount: 3000000 },
      { type: 'expense', amount: 2253268 },
    ];
    const summary = calculatePeriodSummary(txs);
    expect(summary.income).toBe(5971000);
    expect(summary.expense).toBe(5253268);
    expect(summary.balance).toBe(717732);
    expect(summary.count).toBe(4);
  });

  it('returns zeroes for empty transaction list', () => {
    const summary = calculatePeriodSummary([]);
    expect(summary.income).toBe(0);
    expect(summary.expense).toBe(0);
    expect(summary.balance).toBe(0);
    expect(summary.count).toBe(0);
  });
});
