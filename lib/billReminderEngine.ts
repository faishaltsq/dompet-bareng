export interface RecurringBill {
  id: string;
  workspace_id: string;
  title: string;
  amount: number;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  due_day: number;
  next_due_date: string;
  last_paid_at?: string | null;
  is_active: boolean;
  auto_remind: boolean;
}

export function computeDaysUntilDue(dueDate: string, today?: string): number {
  const tStr = today || new Date().toISOString().split('T')[0];
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(tStr + 'T00:00:00');
  const diffTime = due.getTime() - now.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function classifyBill(dueDate: string, today?: string): 'overdue' | 'due_soon' | 'upcoming' {
  const days = computeDaysUntilDue(dueDate, today);
  if (days < 0) return 'overdue';
  if (days <= 3) return 'due_soon';
  return 'upcoming';
}

function formatDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calculateNextDueDate(
  currentDueDate: string,
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
): string {
  const parts = currentDueDate.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1; // 0-indexed
  const day = parts[2];

  const d = new Date(year, month, day);

  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (frequency === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }

  return formatDateString(d);
}

export function calculateMonthlyCommittedAmount(bills: RecurringBill[]): number {
  if (!bills || bills.length === 0) return 0;
  return bills
    .filter((b) => b.is_active)
    .reduce((sum, bill) => {
      let monthlyVal = bill.amount;
      if (bill.frequency === 'daily') monthlyVal = bill.amount * 30;
      else if (bill.frequency === 'weekly') monthlyVal = bill.amount * 4.33;
      else if (bill.frequency === 'yearly') monthlyVal = bill.amount / 12;
      return sum + Math.round(monthlyVal);
    }, 0);
}

export function getUrgentBills(bills: RecurringBill[], today?: string): RecurringBill[] {
  if (!bills || bills.length === 0) return [];
  const active = bills.filter((b) => b.is_active);

  const urgent = active.filter((b) => {
    const status = classifyBill(b.next_due_date, today);
    return status === 'overdue' || status === 'due_soon';
  });

  return urgent.sort((a, b) => {
    const daysA = computeDaysUntilDue(a.next_due_date, today);
    const daysB = computeDaysUntilDue(b.next_due_date, today);
    return daysA - daysB;
  });
}
