import { describe, it, expect } from 'vitest';
import {
  simplifyDebts,
  calculateNetBalancesFromSplits,
  type ExpenseSplit,
  type ParticipantNetBalance,
} from '@/lib/debtSimplifier';

describe('debtSimplifier algorithm', () => {
  describe('simplifyDebts', () => {
    it('simplifies a 3-way circular debt into minimal transfers', () => {
      // Alice paid 60,000 for Alice, Bob, Charlie (20k each) -> Bob owes 20k, Charlie owes 20k, Alice owed 40k
      const balances: ParticipantNetBalance[] = [
        { id: 'alice', name: 'Alice', netBalance: 40000 },
        { id: 'bob', name: 'Bob', netBalance: -20000 },
        { id: 'charlie', name: 'Charlie', netBalance: -20000 },
      ];

      const transfers = simplifyDebts(balances);

      expect(transfers).toHaveLength(2);
      expect(transfers).toContainEqual({
        fromId: 'bob',
        fromName: 'Bob',
        toId: 'alice',
        toName: 'Alice',
        amount: 20000,
      });
      expect(transfers).toContainEqual({
        fromId: 'charlie',
        fromName: 'Charlie',
        toId: 'alice',
        toName: 'Alice',
        amount: 20000,
      });
    });

    it('cancels out intermediate multi-party debts', () => {
      // A owes B 30k, B owes C 30k => Direct A owes C 30k!
      const balances: ParticipantNetBalance[] = [
        { id: 'a', name: 'A', netBalance: -30000 },
        { id: 'b', name: 'B', netBalance: 0 },
        { id: 'c', name: 'C', netBalance: 30000 },
      ];

      const transfers = simplifyDebts(balances);

      expect(transfers).toHaveLength(1);
      expect(transfers[0]).toEqual({
        fromId: 'a',
        fromName: 'A',
        toId: 'c',
        toName: 'C',
        amount: 30000,
      });
    });

    it('returns empty array when everyone is settled', () => {
      const balances: ParticipantNetBalance[] = [
        { id: 'a', name: 'A', netBalance: 0 },
        { id: 'b', name: 'B', netBalance: 0 },
      ];

      expect(simplifyDebts(balances)).toEqual([]);
    });
  });

  describe('calculateNetBalancesFromSplits', () => {
    it('accurately computes net balance across multiple splits', () => {
      const splits: ExpenseSplit[] = [
        {
          id: 's-1',
          workspace_id: 'ws-1',
          title: 'Makan Siang Bersama',
          total_amount: 90000,
          paid_by: 'user-1',
          paid_by_name: 'Budi',
          participants: [
            { id: 'p1', split_id: 's-1', user_id: 'user-1', user_name: 'Budi', owed_amount: 30000, is_settled: false },
            { id: 'p2', split_id: 's-1', user_id: 'user-2', user_name: 'Siti', owed_amount: 30000, is_settled: false },
            { id: 'p3', split_id: 's-1', user_id: 'user-3', user_name: 'Agus', owed_amount: 30000, is_settled: false },
          ],
        },
      ];

      const netBalances = calculateNetBalancesFromSplits(splits);

      const budi = netBalances.find((p) => p.id === 'user-1');
      const siti = netBalances.find((p) => p.id === 'user-2');
      const agus = netBalances.find((p) => p.id === 'user-3');

      // Budi paid 90k, but consumed 30k -> net is +60k
      expect(budi?.netBalance).toBe(60000);
      // Siti consumed 30k, paid 0 -> net is -30k
      expect(siti?.netBalance).toBe(-30000);
      // Agus consumed 30k, paid 0 -> net is -30k
      expect(agus?.netBalance).toBe(-30000);
    });
  });
});
