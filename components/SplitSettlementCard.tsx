import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { type SettlementTransfer } from '@/lib/debtSimplifier';

export interface SplitSettlementCardProps {
  transfers: SettlementTransfer[];
  onSettleUp?: (transfer: SettlementTransfer) => void;
}

export default function SplitSettlementCard({
  transfers,
  onSettleUp,
}: SplitSettlementCardProps) {
  if (!transfers || transfers.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="git-pull-request-outline" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Penyelesaian Patungan</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{transfers.length} Transaksi</Text>
        </View>
      </View>

      <View style={styles.list}>
        {transfers.map((t, idx) => (
          <View key={`${t.fromId}-${t.toId}-${idx}`} style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <View style={styles.avatarMini}>
                <Text style={styles.avatarText}>{(t.fromName[0] || 'U').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <View style={styles.transferFlow}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {t.fromName}
                  </Text>
                  <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} style={{ marginHorizontal: 4 }} />
                  <Text style={styles.nameText} numberOfLines={1}>
                    {t.toName}
                  </Text>
                </View>
                <Text style={styles.amountText}>{formatRupiah(t.amount)}</Text>
              </View>
            </View>

            {onSettleUp && (
              <TouchableOpacity
                style={styles.settleBtn}
                onPress={() => onSettleUp(t)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.settleBtnText}>Lunasi</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: '#F8F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  countBadge: {
    backgroundColor: '#F4EFEA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  list: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FCFBF9',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  transferFlow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    maxWidth: 90,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.expense,
    marginTop: 2,
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  settleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
