import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import FinancialHeroCard from '../../components/FinancialHeroCard';
import SavingsGoalCard from '../../components/SavingsGoalCard';
import { type SavingsGoal } from '../../lib/envelopeAccounting';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s: unknown) => s },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

vi.mock('@/components/Animated', () => ({
  AnimatedFinanceAmount: ({ value }: { value: number }) => `Rp ${value}`,
  AnimatedProgressBar: () => 'ProgressBar',
  FadeSlideIn: ({ children }: { children: React.ReactNode }) => children,
}));

describe('FinancialHeroCard and SavingsGoalCard components', () => {
  it('renders FinancialHeroCard with freeToSpend and goals reserve', () => {
    const tree = renderer
      .create(
        React.createElement(FinancialHeroCard, {
          totalBalance: 10000000,
          reservedInGoals: 4000000,
          freeToSpend: 6000000,
          isOverallocated: false,
          walletName: 'Keluarga Bahagia',
          role: 'admin',
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });

  it('renders SavingsGoalCard with active goals list', () => {
    const sampleGoals: SavingsGoal[] = [
      {
        id: 'g-1',
        workspace_id: 'ws-1',
        title: 'Dana Darurat',
        target_amount: 10000000,
        current_amount: 5000000,
        is_achieved: false,
      },
    ];

    const tree = renderer
      .create(
        React.createElement(SavingsGoalCard, {
          goals: sampleGoals,
          onContribute: vi.fn(),
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
