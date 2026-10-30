import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import SplitSettlementCard from '../../components/SplitSettlementCard';
import { type SettlementTransfer } from '../../lib/debtSimplifier';

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

describe('SplitSettlementCard component', () => {
  const sampleTransfers: SettlementTransfer[] = [
    {
      fromId: 'user-2',
      fromName: 'Siti',
      toId: 'user-1',
      toName: 'Budi',
      amount: 45000,
    },
  ];

  it('renders settlement transfers list', () => {
    const onSettleUp = vi.fn();
    const tree = renderer
      .create(
        React.createElement(SplitSettlementCard, {
          transfers: sampleTransfers,
          onSettleUp,
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });

  it('returns null or empty message when no transfers', () => {
    const tree = renderer
      .create(
        React.createElement(SplitSettlementCard, {
          transfers: [],
        })
      )
      .toJSON();

    expect(tree).toBeNull();
  });
});
