import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';

export interface TransactionSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTypeFilter: 'all' | 'income' | 'expense';
  onTypeFilterChange: (type: 'all' | 'income' | 'expense') => void;
}

export default function TransactionSearchBar({
  searchQuery,
  onSearchChange,
  activeTypeFilter,
  onTypeFilterChange,
}: TransactionSearchBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Cari transaksi, kategori, atau nominal..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearBtn} testID="clear-search-btn">
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chipsContainer}>
        {(['all', 'expense', 'income'] as const).map((type) => {
          const isActive = activeTypeFilter === type;
          const label = type === 'all' ? 'Semua' : type === 'expense' ? 'Pengeluaran' : 'Pemasukan';
          return (
            <TouchableOpacity
              key={type}
              onPress={() => onTypeFilterChange(type)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EFEA',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#F4EFEA',
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
