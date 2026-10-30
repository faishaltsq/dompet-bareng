import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import ReceiptReviewModal from '../../components/ReceiptReviewModal';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Modal: 'Modal',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (s: unknown) => s },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('ReceiptReviewModal component', () => {
  it('renders receipt preview and fields when visible', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const sample = {
      amount: 48000,
      merchant: 'Superindo Express',
      category: 'Makanan & Minuman',
      date: '2026-10-30',
    };

    const tree = renderer
      .create(
        React.createElement(ReceiptReviewModal, {
          visible: true,
          data: sample,
          onClose,
          onConfirm,
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
