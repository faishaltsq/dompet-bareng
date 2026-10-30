import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { type RecurringBill, classifyBill, computeDaysUntilDue } from '@/lib/billReminderEngine';

export interface UpcomingBillsCardProps {
  bills: RecurringBill[];
  onPayAndRecord: (bill: RecurringBill) => void;
  onManageBills?: () => void;
}

export default function UpcomingBillsCard({
  bills,
  onPayAndRecord,
  onManageBills,
}: UpcomingBillsCardProps) {
  if (!bills || bills.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Tagihan Terdekat</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{bills.length}</Text>
          </View>
        </View>

        {onManageBills && (
          <TouchableOpacity onPress={onManageBills} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.manageText}>Kelola</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {bills.map((bill) => {
          const status = classifyBill(bill.next_due_date);
          const days = computeDaysUntilDue(bill.next_due_date);
          const isOverdue = status === 'overdue';

          let dueLabel = `Jatuh tempo dlm ${days} hari`;
          if (days === 0) dueLabel = 'Jatuh tempo hari ini';
          else if (isOverdue) dueLabel = `Terlambat ${Math.abs(days)} hari`;

          return (
            <View key={bill.id} style={styles.billItem}>
              <View style={styles.billTop}>
                <Text style={styles.billTitle} numberOfLines={1}>
                  {bill.title}
                </Text>
                <View style={[styles.statusBadge, isOverdue ? styles.badgeOverdue : styles.badgeDueSoon]}>
                  <Text style={[styles.statusBadgeText, isOverdue ? styles.textOverdue : styles.textDueSoon]}>
                    {dueLabel}
                  </Text>
                </View>
              </View>

              <Text style={styles.billAmount}>{formatRupiah(bill.amount)}</Text>

              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => onPayAndRecord(bill)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.payBtnText}>Bayar & Catat</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  manageText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollList: {
    gap: 12,
    paddingRight: 8,
  },
  billItem: {
    width: 220,
    backgroundColor: '#FCFBF9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  billTop: {
    marginBottom: 6,
  },
  billTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOverdue: {
    backgroundColor: 'rgba(220, 76, 64, 0.12)',
  },
  badgeDueSoon: {
    backgroundColor: 'rgba(229, 138, 58, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textOverdue: {
    color: Colors.expense,
  },
  textDueSoon: {
    color: Colors.warning,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textDark,
    marginVertical: 8,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 8,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
