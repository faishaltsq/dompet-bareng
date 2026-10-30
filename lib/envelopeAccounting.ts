import { type OtterVariant } from '@/components/OtterMascot';

export interface SavingsGoal {
  id: string;
  workspace_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  icon?: string;
  color?: string;
  is_achieved: boolean;
}

export interface EnvelopeBalance {
  totalBalance: number;
  reservedInGoals: number;
  freeToSpend: number;
  envelopeRatioPercent: number;
  isOverallocated: boolean;
}

export function computeEnvelopeBalance(
  totalIncome: number,
  totalExpense: number,
  goals: SavingsGoal[]
): EnvelopeBalance {
  const totalBalance = totalIncome - totalExpense;
  const reservedInGoals = (goals || [])
    .filter((g) => !g.is_achieved)
    .reduce((sum, g) => sum + (g.current_amount || 0), 0);

  const freeToSpend = totalBalance - reservedInGoals;
  const envelopeRatioPercent =
    totalBalance > 0 ? Math.round((reservedInGoals / totalBalance) * 100) : 0;
  const isOverallocated = freeToSpend < 0;

  return {
    totalBalance,
    reservedInGoals,
    freeToSpend,
    envelopeRatioPercent,
    isOverallocated,
  };
}

export function calculateGoalProgress(
  currentAmount: number,
  targetAmount: number
): {
  percent: number;
  isCompleted: boolean;
  remainingAmount: number;
} {
  if (targetAmount <= 0) {
    return { percent: 100, isCompleted: true, remainingAmount: 0 };
  }

  const rawPercent = (currentAmount / targetAmount) * 100;
  const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
  const isCompleted = currentAmount >= targetAmount;
  const remainingAmount = Math.max(0, targetAmount - currentAmount);

  return {
    percent,
    isCompleted,
    remainingAmount,
  };
}

export function getGoalOtterMood(percent: number): OtterVariant {
  if (percent >= 100) return 'rich';
  if (percent >= 60) return 'happy';
  if (percent >= 25) return 'thinking';
  return 'reminder';
}
