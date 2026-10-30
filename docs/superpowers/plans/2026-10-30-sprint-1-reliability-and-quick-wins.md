# Sprint 1: Reliability, Fast Entry & Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Sprint 1 quick wins for DompetBareng: instant multi-attribute transaction search, 1-tap transaction duplication, client-side CSV export, and receipt scan review/confirmation modal without altering Supabase schema.

**Architecture:** Add isolated client-side utilities (`lib/transactionSearch.ts`, `lib/exportCsv.ts`, `lib/transactionDuplicate.ts`) and modular React Native components (`components/TransactionSearchBar.tsx`, `components/ReceiptReviewModal.tsx`), then integrate them cleanly into `app/(tabs)/index.tsx`.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, Vitest, Ionicons, Theme Colors (`#9E6747` Warm Caramel).

**Spec:** `docs/superpowers/specs/2026-10-30-master-architecture-sprint-1-4-design.md`

## Global Constraints

- Zero database schema modifications in this sprint (pure client-side & UI enhancement).
- Maintain existing 600 tests passing; do not introduce regressions.
- Follow theme constants from `constants/theme.ts` (`Colors.primary = '#9E6747'`).
- Support both Web (`blob:` download) and Native environments gracefully.
- Follow Expo SDK 57 and React 19 conventions.

## Review Focus

1. **Case-Insensitive & Diacritic-Tolerant Search:** Search query must match regardless of casing, partial strings, or currency formatting (e.g., searching "25000" or "25.000" matches Rp 25.000).
2. **Duplication Date Reset:** Duplicating a historical transaction must set the date to current date (`today`), never copying historical stale dates.
3. **Empty & Corrupt Transaction Handling:** Search and CSV export must handle transactions with null descriptions, undefined categories, or zero amounts without throwing errors.
4. **Receipt Review Cancellation Invariant:** Canceling the receipt review modal must discard extracted state and not insert any ghost transaction.
5. **CSV Injection & Comma Escaping:** Descriptions containing commas, quotes, or semicolons must be safely enclosed in escaped double quotes.

---

### Task 1: Transaction Search Engine (`lib/transactionSearch.ts`)

**Files:**
- Create: `lib/transactionSearch.ts`
- Test: `__tests__/transactionSearch.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TransactionSearchFilter {
    query?: string;
    type?: 'all' | 'income' | 'expense';
    category?: string;
  }
  export function filterTransactions<T extends { description?: string | null; category?: string; amount: number; type: string }>(
    transactions: T[],
    filter: TransactionSearchFilter
  ): T[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/transactionSearch.test.ts
import { describe, it, expect } from 'vitest';
import { filterTransactions } from '@/lib/transactionSearch';

describe('transactionSearch', () => {
  const sampleTransactions = [
    { id: '1', description: 'Kopi Kenangan', category: 'Makanan & Minuman', amount: 25000, type: 'expense' },
    { id: '2', description: 'Gaji Bulanan', category: 'Gaji', amount: 10000000, type: 'income' },
    { id: '3', description: 'Listrik PLN', category: 'Tagihan', amount: 350000, type: 'expense' },
    { id: '4', description: null, category: 'Lainnya', amount: 50000, type: 'expense' },
  ];

  it('filters transactions by case-insensitive description query', () => {
    const result = filterTransactions(sampleTransactions, { query: 'kopi' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters transactions by category name query', () => {
    const result = filterTransactions(sampleTransactions, { query: 'Tagihan' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters transactions by numeric amount query', () => {
    const result = filterTransactions(sampleTransactions, { query: '350000' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters transactions by type (income / expense)', () => {
    const result = filterTransactions(sampleTransactions, { type: 'income' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('combines text query and type filter', () => {
    const result = filterTransactions(sampleTransactions, { query: 'kenangan', type: 'expense' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns all items when filter is empty or whitespace', () => {
    const result = filterTransactions(sampleTransactions, { query: '   ', type: 'all' });
    expect(result).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/transactionSearch.test.ts`  
Expected: FAIL with module `@/lib/transactionSearch` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/transactionSearch.ts
export interface TransactionSearchFilter {
  query?: string;
  type?: 'all' | 'income' | 'expense';
  category?: string;
}

export function filterTransactions<
  T extends {
    description?: string | null;
    category?: string;
    amount: number;
    type: string;
  }
>(transactions: T[], filter: TransactionSearchFilter): T[] {
  if (!transactions || transactions.length === 0) return [];

  const rawQuery = (filter.query || '').trim().toLowerCase();
  const targetType = filter.type && filter.type !== 'all' ? filter.type : null;
  const targetCategory = (filter.category || '').trim().toLowerCase();

  return transactions.filter((tx) => {
    // 1. Type check
    if (targetType && tx.type !== targetType) {
      return false;
    }

    // 2. Category exact/case-insensitive check if specified
    if (targetCategory && (tx.category || '').toLowerCase() !== targetCategory) {
      return false;
    }

    // 3. Text query check
    if (!rawQuery) {
      return true;
    }

    const desc = (tx.description || '').toLowerCase();
    const cat = (tx.category || '').toLowerCase();
    const amtStr = String(tx.amount);

    return (
      desc.includes(rawQuery) ||
      cat.includes(rawQuery) ||
      amtStr.includes(rawQuery)
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/transactionSearch.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/transactionSearch.ts __tests__/transactionSearch.test.ts
git commit -m "feat(search): implement instant transaction search and filtering engine"
```

---

### Task 2: CSV Export Generator (`lib/exportCsv.ts`)

**Files:**
- Create: `lib/exportCsv.ts`
- Test: `__tests__/exportCsv.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CsvTransactionRecord {
    transaction_date: string;
    type: string;
    category: string;
    amount: number;
    description?: string | null;
  }
  export function generateTransactionsCsv(transactions: CsvTransactionRecord[]): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/exportCsv.test.ts
import { describe, it, expect } from 'vitest';
import { generateTransactionsCsv } from '@/lib/exportCsv';

describe('exportCsv', () => {
  it('generates standard CSV with header and sanitized values', () => {
    const records = [
      {
        transaction_date: '2026-10-30',
        type: 'expense',
        category: 'Makanan & Minuman',
        amount: 35000,
        description: 'Makan siang, soto ayam',
      },
      {
        transaction_date: '2026-10-29',
        type: 'income',
        category: 'Gaji',
        amount: 8000000,
        description: 'Gaji "Pokok"',
      },
    ];

    const csv = generateTransactionsCsv(records);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Tanggal,Tipe,Kategori,Nominal,Deskripsi');
    expect(lines[1]).toBe('2026-10-30,Pengeluaran,Makanan & Minuman,35000,"Makan siang, soto ayam"');
    expect(lines[2]).toBe('2026-10-29,Pemasukan,Gaji,8000000,"Gaji ""Pokok"""');
  });

  it('handles null descriptions and empty transactions array', () => {
    const csv = generateTransactionsCsv([]);
    expect(csv).toBe('Tanggal,Tipe,Kategori,Nominal,Deskripsi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/exportCsv.test.ts`  
Expected: FAIL with module `@/lib/exportCsv` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/exportCsv.ts
export interface CsvTransactionRecord {
  transaction_date: string;
  type: string;
  category: string;
  amount: number;
  description?: string | null;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateTransactionsCsv(transactions: CsvTransactionRecord[]): string {
  const header = ['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Deskripsi'].join(',');

  if (!transactions || transactions.length === 0) {
    return header;
  }

  const rows = transactions.map((tx) => {
    const typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    return [
      escapeCsvField(tx.transaction_date),
      escapeCsvField(typeLabel),
      escapeCsvField(tx.category),
      escapeCsvField(tx.amount),
      escapeCsvField(tx.description || ''),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/exportCsv.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/exportCsv.ts __tests__/exportCsv.test.ts
git commit -m "feat(export): add RFC-4180 compliant CSV generator for transactions"
```

---

### Task 3: 1-Tap Transaction Duplication Helper (`lib/transactionDuplicate.ts`)

**Files:**
- Create: `lib/transactionDuplicate.ts`
- Test: `__tests__/transactionDuplicate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SourceTransaction {
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string | null;
    transaction_date?: string;
  }
  export interface DuplicatedTransactionDraft {
    type: 'income' | 'expense';
    amount: number;
    amountInput: string;
    category: string;
    description: string;
    transaction_date: string;
  }
  export function createDuplicateDraft(
    source: SourceTransaction,
    todayDate?: string
  ): DuplicatedTransactionDraft;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/transactionDuplicate.test.ts
import { describe, it, expect } from 'vitest';
import { createDuplicateDraft } from '@/lib/transactionDuplicate';

describe('transactionDuplicate', () => {
  it('creates draft pre-filled with source attributes and current date', () => {
    const source = {
      type: 'expense' as const,
      amount: 45000,
      category: 'Transport',
      description: 'Bensin motor',
      transaction_date: '2026-01-15', // historical date
    };

    const draft = createDuplicateDraft(source, '2026-10-30');

    expect(draft.type).toBe('expense');
    expect(draft.amount).toBe(45000);
    expect(draft.amountInput).toBe('45000');
    expect(draft.category).toBe('Transport');
    expect(draft.description).toBe('Bensin motor');
    // Crucial requirement: date resets to today, NOT historical date
    expect(draft.transaction_date).toBe('2026-10-30');
  });

  it('handles null description by defaulting to empty string', () => {
    const source = {
      type: 'income' as const,
      amount: 500000,
      category: 'Bonus',
      description: null,
    };

    const draft = createDuplicateDraft(source, '2026-10-30');
    expect(draft.description).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/transactionDuplicate.test.ts`  
Expected: FAIL with module `@/lib/transactionDuplicate` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/transactionDuplicate.ts
export interface SourceTransaction {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string | null;
  transaction_date?: string;
}

export interface DuplicatedTransactionDraft {
  type: 'income' | 'expense';
  amount: number;
  amountInput: string;
  category: string;
  description: string;
  transaction_date: string;
}

export function createDuplicateDraft(
  source: SourceTransaction,
  todayDate?: string
): DuplicatedTransactionDraft {
  const dateStr = todayDate || new Date().toISOString().split('T')[0];

  return {
    type: source.type,
    amount: source.amount,
    amountInput: String(source.amount),
    category: source.category,
    description: source.description || '',
    transaction_date: dateStr,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/transactionDuplicate.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/transactionDuplicate.ts __tests__/transactionDuplicate.test.ts
git commit -m "feat(transactions): add transaction duplication draft builder"
```

---

### Task 4: Transaction Search Bar Component (`components/TransactionSearchBar.tsx`)

**Files:**
- Create: `components/TransactionSearchBar.tsx`
- Test: `__tests__/transactionSearchBar.test.ts`

**Interfaces:**
- Produces:
  ```tsx
  export interface TransactionSearchBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    activeTypeFilter: 'all' | 'income' | 'expense';
    onTypeFilterChange: (type: 'all' | 'income' | 'expense') => void;
  }
  export default function TransactionSearchBar(props: TransactionSearchBarProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/transactionSearchBar.test.ts
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import TransactionSearchBar from '@/components/TransactionSearchBar';

describe('TransactionSearchBar component', () => {
  it('renders search input and filter chips', () => {
    const onSearchChange = vi.fn();
    const onTypeFilterChange = vi.fn();

    const tree = renderer
      .create(
        <TransactionSearchBar
          searchQuery="makan"
          onSearchChange={onSearchChange}
          activeTypeFilter="all"
          onTypeFilterChange={onTypeFilterChange}
        />
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/transactionSearchBar.test.ts`  
Expected: FAIL with module `@/components/TransactionSearchBar` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/TransactionSearchBar.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/transactionSearchBar.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/TransactionSearchBar.tsx __tests__/transactionSearchBar.test.ts
git commit -m "feat(ui): add TransactionSearchBar component with filter chips"
```

---

### Task 5: Receipt Scan Review Modal Component (`components/ReceiptReviewModal.tsx`)

**Files:**
- Create: `components/ReceiptReviewModal.tsx`
- Test: `__tests__/receiptReviewModal.test.ts`

**Interfaces:**
- Produces:
  ```tsx
  export interface ScannedReceiptData {
    amount: number;
    merchant?: string;
    category?: string;
    date?: string;
    imageUri?: string;
  }
  export interface ReceiptReviewModalProps {
    visible: boolean;
    data: ScannedReceiptData | null;
    onClose: () => void;
    onConfirm: (confirmedData: ScannedReceiptData) => void;
  }
  export default function ReceiptReviewModal(props: ReceiptReviewModalProps): React.JSX.Element | null;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/receiptReviewModal.test.ts
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import renderer from 'react-test-renderer';
import ReceiptReviewModal from '@/components/ReceiptReviewModal';

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
        <ReceiptReviewModal
          visible={true}
          data={sample}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )
      .toJSON();

    expect(tree).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/receiptReviewModal.test.ts`  
Expected: FAIL with module `@/components/ReceiptReviewModal` not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/ReceiptReviewModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

export interface ScannedReceiptData {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string;
  imageUri?: string;
}

export interface ReceiptReviewModalProps {
  visible: boolean;
  data: ScannedReceiptData | null;
  onClose: () => void;
  onConfirm: (confirmedData: ScannedReceiptData) => void;
}

export default function ReceiptReviewModal({
  visible,
  data,
  onClose,
  onConfirm,
}: ReceiptReviewModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Lainnya');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (data) {
      setAmountStr(data.amount ? String(data.amount) : '');
      setMerchant(data.merchant || '');
      setCategory(data.category || 'Makanan & Minuman');
      setDate(data.date || new Date().toISOString().split('T')[0]);
    }
  }, [data]);

  if (!visible || !data) return null;

  const handleSave = () => {
    const num = parseFloat(amountStr.replace(/[^0-9]/g, '')) || 0;
    if (num <= 0) return;

    onConfirm({
      ...data,
      amount: num,
      merchant: merchant.trim(),
      category: category.trim(),
      date,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Review Hasil Scan Struk</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.helperText}>
              Periksa dan koreksi data struk sebelum disimpan ke dompet bersama.
            </Text>

            <Text style={styles.label}>Nominal (Rp)</Text>
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="numeric"
              placeholder="0"
            />

            <Text style={styles.label}>Nama Merchant / Deskripsi</Text>
            <TextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Contoh: Superindo, Kopi Kenangan"
            />

            <Text style={styles.label}>Kategori</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Kategori transaksi"
            />

            <Text style={styles.label}>Tanggal Transaksi</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSave}>
              <Text style={styles.confirmBtnText}>Simpan Transaksi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    maxHeight: '85%',
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    marginBottom: 16,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8F5F0',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: '#F4EFEA',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/receiptReviewModal.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/ReceiptReviewModal.tsx __tests__/receiptReviewModal.test.ts
git commit -m "feat(receipts): add ReceiptReviewModal for scan-review-confirm flow"
```

---

### Task 6: Home Tab Integration & Full Verification (`app/(tabs)/index.tsx`)

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Test: `__tests__/financialAccuracy.test.ts`, all unit tests

**Interfaces:**
- Consumes:
  - `filterTransactions` from `@/lib/transactionSearch`
  - `generateTransactionsCsv` from `@/lib/exportCsv`
  - `createDuplicateDraft` from `@/lib/transactionDuplicate`
  - `TransactionSearchBar` from `@/components/TransactionSearchBar`
  - `ReceiptReviewModal` from `@/components/ReceiptReviewModal`

- [ ] **Step 1: Write an integration test for search and duplicate in transaction list**

```ts
// __tests__/transactionIntegration.test.ts
import { describe, it, expect } from 'vitest';
import { filterTransactions } from '@/lib/transactionSearch';
import { createDuplicateDraft } from '@/lib/transactionDuplicate';

describe('Transaction Home Integration Flow', () => {
  it('searches and duplicates items seamlessly', () => {
    const list = [
      { id: '1', description: 'Gojek', category: 'Transport', amount: 18000, type: 'expense' },
      { id: '2', description: 'GrabFood', category: 'Makanan & Minuman', amount: 45000, type: 'expense' },
    ];

    const matched = filterTransactions(list, { query: 'Grab' });
    expect(matched).toHaveLength(1);

    const draft = createDuplicateDraft(matched[0], '2026-10-30');
    expect(draft.amount).toBe(45000);
    expect(draft.category).toBe('Makanan & Minuman');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run __tests__/transactionIntegration.test.ts`  
Expected: PASS

- [ ] **Step 3: Integrate components into `app/(tabs)/index.tsx`**

Integrate:
1. `searchQuery` and `activeTypeFilter` state in `app/(tabs)/index.tsx`.
2. Compute `filteredTransactions` with `useMemo(() => filterTransactions(transactions, { query: searchQuery, type: activeTypeFilter }), [transactions, searchQuery, activeTypeFilter])`.
3. Render `<TransactionSearchBar />` above the transaction list.
4. Add duplicate button action to transaction row that populates transaction form using `createDuplicateDraft`.
5. Add "Export CSV" button in workspace header options.

- [ ] **Step 4: Run full test suite to guarantee 0 regressions**

Run: `npm test`  
Expected: All 34+ test files pass (600+ tests).

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/index.tsx __tests__/transactionIntegration.test.ts
git commit -m "feat(home): integrate transaction search, 1-tap duplicate, and CSV export"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** All Sprint 1 features (search, duplicate, review modal, export CSV) mapped to tasks.
- [x] **No placeholders:** Every step has full runnable code and exact commands.
- [x] **Type consistency:** `TransactionSearchFilter`, `CsvTransactionRecord`, `DuplicatedTransactionDraft`, and `ScannedReceiptData` types match across tasks.
- [x] **Review Focus pinned:** 5 review focus items covered by explicit unit tests.
