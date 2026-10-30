import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadows } from '@/constants/theme';
import { formatRupiah } from '@/lib/utils';
import { type SavingsGoal, calculateGoalProgress } from '@/lib/envelopeAccounting';
import { AnimatedProgressBar } from '@/components/Animated';

export interface SavingsGoalCardProps {
  goals: SavingsGoal[];
  onAddGoal?: () => void;
  onContribute?: (goal: SavingsGoal) => void;
}

export default function SavingsGoalCard({
  goals,
  onAddGoal,
  onContribute,
}: SavingsGoalCardProps) {
  if (!goals || goals.length === 0) {
    return null;
  }

  const activeGoals = goals.filter((g) => !g.is_achieved);
  if (activeGoals.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="flag-outline" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Target Tabungan</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{activeGoals.length}</Text>
          </View>
        </View>

        {onAddGoal && (
          <TouchableOpacity onPress={onAddGoal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.addText}>+ Target Baru</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {activeGoals.map((goal) => {
          const progress = calculateGoalProgress(goal.current_amount, goal.target_amount);

          return (
            <View key={goal.id} style={styles.goalItem}>
              <View style={styles.goalTop}>
                <Text style={styles.goalTitle} numberOfLines={1}>
                  {goal.title}
                </Text>
                <Text style={styles.goalPercent}>{progress.percent}%</Text>
              </View>

              <View style={styles.progressWrap}>
                <AnimatedProgressBar
                  progress={progress.percent / 100}
                  color={goal.color || Colors.primary}
                />
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.currentAmount}>{formatRupiah(goal.current_amount)}</Text>
                <Text style={styles.targetAmount}> / {formatRupiah(goal.target_amount)}</Text>
              </View>

              {onContribute && (
                <TouchableOpacity
                  style={styles.contributeBtn}
                  onPress={() => onContribute(goal)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={14} color="#FFFFFF" style={{ marginRight: 2 }} />
                  <Text style={styles.contributeBtnText}>Nabung</Text>
                </TouchableOpacity>
              )}
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
  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  scrollList: {
    gap: 12,
    paddingRight: 8,
  },
  goalItem: {
    width: 220,
    backgroundColor: '#FCFBF9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  goalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textDark,
    flex: 1,
    marginRight: 6,
  },
  goalPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressWrap: {
    marginVertical: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 8,
  },
  currentAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDark,
  },
  targetAmount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 6,
  },
  contributeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
