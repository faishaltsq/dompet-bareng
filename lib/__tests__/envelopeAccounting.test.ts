import { describe, it, expect } from 'vitest';
import {
  computeEnvelopeBalance,
  calculateGoalProgress,
  getGoalOtterMood,
  type SavingsGoal,
} from '@/lib/envelopeAccounting';

describe('envelopeAccounting', () => {
  const sampleGoals: SavingsGoal[] = [
    {
      id: 'g-1',
      workspace_id: 'ws-1',
      title: 'Dana Darurat',
      target_amount: 10000000,
      current_amount: 3000000,
      is_achieved: false,
    },
    {
      id: 'g-2',
      workspace_id: 'ws-1',
      title: 'Liburan Akhir Tahun',
      target_amount: 5000000,
      current_amount: 2000000,
      is_achieved: false,
    },
    {
      id: 'g-3',
      workspace_id: 'ws-1',
      title: 'Beli Sepeda (Achieved)',
      target_amount: 4000000,
      current_amount: 4000000,
      is_achieved: true, // Already achieved, not reserving active balance
    },
  ];

  describe('computeEnvelopeBalance', () => {
    it('calculates total balance, reserved in goals, and free to spend', () => {
      // Income = 15,000,000, Expense = 5,000,000 => Total Balance = 10,000,000
      // Active goals = 3,000,000 + 2,000,000 = 5,000,000
      // Free to spend = 10,000,000 - 5,000,000 = 5,000,000
      const envelope = computeEnvelopeBalance(15000000, 5000000, sampleGoals);
      expect(envelope.totalBalance).toBe(10000000);
      expect(envelope.reservedInGoals).toBe(5000000);
      expect(envelope.freeToSpend).toBe(5000000);
      expect(envelope.envelopeRatioPercent).toBe(50);
      expect(envelope.isOverallocated).toBe(false);
    });

    it('detects overallocation when goals exceed cash balance', () => {
      // Income = 6,000,000, Expense = 3,000,000 => Total Balance = 3,000,000
      // Reserved in goals = 5,000,000
      // Free to spend = -2,000,000 (overallocated)
      const envelope = computeEnvelopeBalance(6000000, 3000000, sampleGoals);
      expect(envelope.totalBalance).toBe(3000000);
      expect(envelope.reservedInGoals).toBe(5000000);
      expect(envelope.freeToSpend).toBe(-2000000);
      expect(envelope.isOverallocated).toBe(true);
    });
  });

  describe('calculateGoalProgress', () => {
    it('calculates progress percent and remaining amount', () => {
      const progress = calculateGoalProgress(2500000, 10000000);
      expect(progress.percent).toBe(25);
      expect(progress.isCompleted).toBe(false);
      expect(progress.remainingAmount).toBe(7500000);
    });

    it('caps progress at 100% when goal is reached or exceeded', () => {
      const progress = calculateGoalProgress(12000000, 10000000);
      expect(progress.percent).toBe(100);
      expect(progress.isCompleted).toBe(true);
      expect(progress.remainingAmount).toBe(0);
    });
  });

  describe('getGoalOtterMood', () => {
    it('returns suitable mascot mood depending on percentage', () => {
      expect(getGoalOtterMood(100)).toBe('rich');
      expect(getGoalOtterMood(75)).toBe('happy');
      expect(getGoalOtterMood(30)).toBe('thinking');
      expect(getGoalOtterMood(5)).toBe('reminder');
    });
  });
});
