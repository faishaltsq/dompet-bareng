import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWorkspace } from '@/context/WorkspaceContext';
import { formatRupiah, formatDateTime, getCategoryMeta } from '@/lib/utils';
import { Colors, Shadows, Radius } from '@/constants/theme';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, deleteTransaction } = useWorkspace();

  const tx = transactions.find(t => t.id === id);

  if (!tx) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={s.notFoundBox}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={s.notFoundText}>Transaksi tidak ditemukan.</Text>
          <TouchableOpacity style={s.backBtnFallback} onPress={() => router.back()}>
            <Text style={s.backBtnFallbackText}>Kembali</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const meta = getCategoryMeta(tx.category);
  const isIncome = tx.type === 'income';

  const handleDelete = () => {
    Alert.alert(
      'Hapus Transaksi',
      'Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(tx.id);
            router.back();
          },
        },
      ]
    );
  };

  // Format jam dari created_at (lebih presisi) dan tanggal transaksi
  const createdAt = formatDateTime(tx.created_at);
  const txDate = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[s.header, { backgroundColor: isIncome ? Colors.income : Colors.expense }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Detail Transaksi</Text>
        <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Amount Card */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={[s.heroCard, { backgroundColor: isIncome ? Colors.income : Colors.expense }]}
        >
          <View style={[s.categoryIconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={{ fontSize: 36 }}>{meta.emoji}</Text>
          </View>
          <Text style={s.heroCategory}>{tx.category}</Text>
          <Text style={s.heroAmount}>
            {isIncome ? '+' : '-'}{formatRupiah(tx.amount)}
          </Text>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>
              {isIncome ? '⬆️ Pemasukan' : '⬇️ Pengeluaran'}
            </Text>
          </View>
        </Animated.View>

        {/* Detail Info Rows */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.detailCard}>
          <DetailRow
            icon="📅"
            label="Tanggal Transaksi"
            value={txDate}
          />
          <View style={s.divider} />
          <DetailRow
            icon="🕐"
            label="Dicatat Pada"
            value={createdAt}
          />
          <View style={s.divider} />
          <DetailRow
            icon="🏷️"
            label="Kategori"
            value={tx.category}
            valueColor={meta.color}
          />
          {tx.description ? (
            <>
              <View style={s.divider} />
              <DetailRow
                icon="📝"
                label="Catatan"
                value={tx.description}
              />
            </>
          ) : null}
          <View style={s.divider} />
          <DetailRow
            icon="👤"
            label="Dicatat oleh"
            value={tx.user_display_name || tx.user_email?.split('@')[0] || 'Anggota'}
          />
          <View style={s.divider} />
          <DetailRow
            icon="💵"
            label="Nominal"
            value={formatRupiah(tx.amount)}
            valueColor={isIncome ? Colors.income : Colors.expense}
            valueBold
          />
        </Animated.View>

        {/* Struk / Receipt Image */}
        {tx.image_url ? (
          <Animated.View entering={FadeIn.delay(160).duration(400)} style={s.receiptCard}>
            <View style={s.receiptCardHeader}>
              <Text style={s.receiptCardTitle}>📷 Foto Struk / Nota</Text>
            </View>
            <Image
              source={{ uri: tx.image_url }}
              style={s.receiptImage}
              resizeMode="contain"
            />
          </Animated.View>
        ) : null}

        {/* Hapus Button */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <TouchableOpacity style={s.deleteFullBtn} onPress={handleDelete}>
            <Text style={s.deleteFullBtnText}>🗑️ Hapus Transaksi Ini</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor,
  valueBold,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  valueBold?: boolean;
}) {
  return (
    <View style={dr.row}>
      <View style={dr.iconWrap}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={dr.textWrap}>
        <Text style={dr.label}>{label}</Text>
        <Text style={[dr.value, valueColor ? { color: valueColor } : {}, valueBold && { fontWeight: '800' }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const dr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  label: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  value: { fontSize: 15, color: Colors.textDark, fontWeight: '600', lineHeight: 21 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 28, fontWeight: '400', marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },

  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },

  // Hero card (colored background)
  heroCard: {
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    ...Shadows.float,
  },
  categoryIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Detail rows card
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },

  // Receipt
  receiptCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  receiptCardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  receiptCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  receiptImage: {
    width: '100%',
    height: 260,
    backgroundColor: Colors.borderLight,
  },

  // Delete button
  deleteFullBtn: {
    backgroundColor: Colors.expenseSoft,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD7DB',
    marginTop: 4,
  },
  deleteFullBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.expense,
  },

  // Fallback
  notFoundBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  notFoundText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  backBtnFallback: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  backBtnFallbackText: {
    color: '#fff',
    fontWeight: '700',
  },
});
