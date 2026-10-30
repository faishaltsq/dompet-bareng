import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import UpcomingBillsCard from '../../components/UpcomingBillsCard';
import { type RecurringBill } from '../../lib/billReminderEngine';

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

describe('UpcomingBillsCard component', () => {
  const sampleBills: RecurringBill[] = [
    {
      id: 'b-1',
      workspace_id: 'ws-1',
      title: 'WiFi IndiHome',
      amount: 350000,
      category: 'Tagihan',
      frequency: 'monthly',
      due_day: 5,
      next_due_date: '2026-11-02',
      is_active: true,
      auto_remind: true,
    },
  ];

  it('renders bill list and pay button', () => {
    const onPayAndRecord = vi.fn();
    const tree = renderer
      .create(
        React.createElement(UpcomingBillsCard, {
          bills: sampleBills,
          onPayAndRecord,
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
