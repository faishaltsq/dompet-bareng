import { describe, it, expect } from 'vitest';
import {
  computeDaysUntilDue,
  classifyBill,
  calculateNextDueDate,
  calculateMonthlyCommittedAmount,
  getUrgentBills,
  type RecurringBill,
} from '@/lib/billReminderEngine';

describe('billReminderEngine', () => {
  describe('computeDaysUntilDue and classifyBill', () => {
    const today = '2026-10-30';

    it('identifies overdue bill', () => {
      const days = computeDaysUntilDue('2026-10-28', today);
      expect(days).toBe(-2);
      expect(classifyBill('2026-10-28', today)).toBe('overdue');
    });

    it('identifies due today bill', () => {
      const days = computeDaysUntilDue('2026-10-30', today);
      expect(days).toBe(0);
      expect(classifyBill('2026-10-30', today)).toBe('due_soon');
    });

    it('identifies due soon bill within 3 days', () => {
      const days = computeDaysUntilDue('2026-11-02', today);
      expect(days).toBe(3);
      expect(classifyBill('2026-11-02', today)).toBe('due_soon');
    });

    it('identifies upcoming bill farther than 3 days', () => {
      const days = computeDaysUntilDue('2026-11-15', today);
      expect(days).toBe(16);
      expect(classifyBill('2026-11-15', today)).toBe('upcoming');
    });
  });

  describe('calculateNextDueDate', () => {
    it('advances monthly bill to next month', () => {
      expect(calculateNextDueDate('2026-10-30', 'monthly')).toBe('2026-11-30');
      expect(calculateNextDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
    });

    it('advances weekly bill by 7 days', () => {
      expect(calculateNextDueDate('2026-10-30', 'weekly')).toBe('2026-11-06');
    });

    it('advances daily bill by 1 day', () => {
      expect(calculateNextDueDate('2026-10-30', 'daily')).toBe('2026-10-31');
    });

    it('advances yearly bill by 1 year', () => {
      expect(calculateNextDueDate('2026-10-30', 'yearly')).toBe('2027-10-30');
    });
  });

  describe('calculateMonthlyCommittedAmount and getUrgentBills', () => {
    const sampleBills: RecurringBill[] = [
      {
        id: 'b-1',
        workspace_id: 'ws-1',
        title: 'WiFi IndiHome',
        amount: 350000,
        category: 'Tagihan',
        frequency: 'monthly',
        due_day: 5,
        next_due_date: '2026-11-02', // due in 3 days
        is_active: true,
        auto_remind: true,
      },
      {
        id: 'b-2',
        workspace_id: 'ws-1',
        title: 'Netflix Premium',
        amount: 186000,
        category: 'Hiburan',
        frequency: 'monthly',
        due_day: 20,
        next_due_date: '2026-11-20', // upcoming
        is_active: true,
        auto_remind: true,
      },
      {
        id: 'b-3',
        workspace_id: 'ws-1',
        title: 'Iuran Kas Kos (Overdue)',
        amount: 50000,
        category: 'Tagihan',
        frequency: 'monthly',
        due_day: 25,
        next_due_date: '2026-10-25', // overdue
        is_active: true,
        auto_remind: true,
      },
      {
        id: 'b-4',
        workspace_id: 'ws-1',
        title: 'Langganan Inactive',
        amount: 100000,
        category: 'Lainnya',
        frequency: 'monthly',
        due_day: 1,
        next_due_date: '2026-11-01',
        is_active: false,
        auto_remind: true,
      },
    ];

    it('computes monthly committed amount for active bills', () => {
      // 350,000 + 186,000 + 50,000 = 586,000 (inactive b-4 excluded)
      const committed = calculateMonthlyCommittedAmount(sampleBills);
      expect(committed).toBe(586000);
    });

    it('filters urgent bills (overdue & due soon, active only)', () => {
      const urgent = getUrgentBills(sampleBills, '2026-10-30');
      expect(urgent).toHaveLength(2);
      expect(urgent[0].id).toBe('b-3'); // overdue first
      expect(urgent[1].id).toBe('b-1'); // due soon second
    });
  });
});
