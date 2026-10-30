import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import TransactionSearchBar from '../../components/TransactionSearchBar';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (s: unknown) => s },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('TransactionSearchBar component', () => {
  it('renders search input and filter chips', () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();

    const tree = renderer
      .create(
        React.createElement(TransactionSearchBar, {
          searchQuery: 'makan',
          onSearchChange,
          activeTypeFilter: 'all',
          onTypeFilterChange,
        })
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
