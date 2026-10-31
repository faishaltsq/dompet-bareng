export type PeriodFilter = 'all' | 'month' | 'week' | 'day';

export interface LocalDateParts {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  day: number;   // 1-indexed (1..31)
  dateKey: string; // 'YYYY-MM-DD'
}

/**
 * Safely parse date string into local date parts (year, month 0-indexed, day 1-indexed).
 * Supports 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss...', and similar formats.
 */
export function parseLocalDate(dateStr: string): LocalDateParts | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return {
    year,
    month,
    day,
    dateKey: `${match[1]}-${match[2]}-${match[3]}`,
  };
}

/**
 * Determine whether a transaction date falls into the specified period.
 * - 'day': exactly matches referenceDate calendar day (today)
 * - 'week': current calendar week (Monday 00:00:00 to Sunday 23:59:59)
 * - 'month': current calendar month (1st of month to end of month)
 * - 'all': matches all dates
 */
export function isDateInPeriod(
  dateStr: string,
  period: PeriodFilter,
  referenceDate: Date = new Date()
): boolean {
  if (period === 'all') return true;
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return false;

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  if (period === 'day') {
    return parsed.year === currentYear && parsed.month === currentMonth && parsed.day === currentDay;
  }

  if (period === 'month') {
    return parsed.year === currentYear && parsed.month === currentMonth;
  }

  if (period === 'week') {
    // Standard calendar week in ID/ISO: Monday to Sunday
    const dayOfWeek = referenceDate.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(currentYear, currentMonth, currentDay - diffToMonday, 0, 0, 0, 0);
    const sundayEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    const txDate = new Date(parsed.year, parsed.month, parsed.day, 12, 0, 0, 0);
    return txDate >= monday && txDate <= sundayEnd;
  }

  return true;
}

export interface PeriodSummary {
  income: number;
  expense: number;
  balance: number;
  count: number;
}

/**
 * Calculate financial totals (income, expense, net balance, transaction count)
 * from a list of transactions.
 */
export function calculatePeriodSummary(
  transactions: Array<{ type: string; amount: number }>
): PeriodSummary {
  return transactions.reduce(
    (acc, t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        acc.income += amt;
      } else if (t.type === 'expense') {
        acc.expense += amt;
      }
      acc.balance = acc.income - acc.expense;
      acc.count += 1;
      return acc;
    },
    { income: 0, expense: 0, balance: 0, count: 0 }
  );
}
