import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { AnimatedFinanceAmount } from '@/components/Animated';

export interface FinancialHeroCardProps {
  totalBalance: number;
  reservedInGoals: number;
  freeToSpend: number;
  isOverallocated: boolean;
  walletName: string;
  role?: string;
  onSwitchWallet?: () => void;
}

export default function FinancialHeroCard({
  totalBalance,
  reservedInGoals,
  freeToSpend,
  isOverallocated,
  walletName,
  role,
  onSwitchWallet,
}: FinancialHeroCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.walletPill}
          onPress={onSwitchWallet}
          disabled={!onSwitchWallet}
          activeOpacity={0.8}
        >
          <Ionicons name="wallet-outline" size={14} color={Colors.primary} />
          <Text style={styles.walletName} numberOfLines={1}>
            {walletName}
          </Text>
          {role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          )}
          {onSwitchWallet && <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <View style={styles.mainBalanceWrap}>
        <Text style={styles.mainBalanceLabel}>Saldo Siap Pakai</Text>
        <AnimatedFinanceAmount
          value={freeToSpend}
          style={[styles.mainBalanceAmount, isOverallocated && styles.textDanger]}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.subBalancesRow}>
        <View style={styles.subCol}>
          <Text style={styles.subLabel}>Total Kas</Text>
          <Text style={styles.subAmount}>{formatRupiah(totalBalance)}</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.subCol}>
          <Text style={styles.subLabel}>Terkunci di Goals</Text>
          <Text style={styles.subAmount}>{formatRupiah(reservedInGoals)}</Text>
        </View>
      </View>

      {isOverallocated && (
        <View style={styles.warningBanner}>
          <Ionicons name="alert-circle" size={14} color={Colors.expense} />
          <Text style={styles.warningText}>
            Alokasi goals melebihi total kas dompet saat ini!
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F5F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 6,
  },
  walletName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  roleBadge: {
    backgroundColor: '#ECE4DB',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  mainBalanceWrap: {
    marginVertical: 4,
  },
  mainBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 2,
  },
  mainBalanceAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textDark,
    letterSpacing: -0.5,
  },
  textDanger: {
    color: Colors.expense,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  subBalancesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subCol: {
    flex: 1,
  },
  subLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  subAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    marginTop: 12,
  },
  warningText: {
    fontSize: 11,
    color: Colors.expense,
    fontWeight: '600',
  },
});
