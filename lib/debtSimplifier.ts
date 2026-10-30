export interface ExpenseSplitParticipant {
  id: string;
  split_id: string;
  user_id?: string | null;
  user_name: string;
  owed_amount: number;
  is_settled: boolean;
}

export interface ExpenseSplit {
  id: string;
  workspace_id: string;
  title: string;
  total_amount: number;
  paid_by?: string | null;
  paid_by_name: string;
  participants: ExpenseSplitParticipant[];
}

export interface ParticipantNetBalance {
  id: string;
  name: string;
  netBalance: number;
}

export interface SettlementTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export function calculateNetBalancesFromSplits(
  splits: ExpenseSplit[]
): ParticipantNetBalance[] {
  const map = new Map<string, { id: string; name: string; netBalance: number }>();

  for (const split of splits) {
    const payerId = split.paid_by || split.paid_by_name;
    const payerEntry = map.get(payerId) || {
      id: payerId,
      name: split.paid_by_name,
      netBalance: 0,
    };
    // Payer paid total_amount
    payerEntry.netBalance += split.total_amount;
    map.set(payerId, payerEntry);

    // Each participant consumed owed_amount
    for (const part of split.participants) {
      if (part.is_settled) continue;
      const partId = part.user_id || part.user_name;
      const partEntry = map.get(partId) || {
        id: partId,
        name: part.user_name,
        netBalance: 0,
      };
      partEntry.netBalance -= part.owed_amount;
      map.set(partId, partEntry);
    }
  }

  return Array.from(map.values());
}

export function simplifyDebts(
  participants: ParticipantNetBalance[]
): SettlementTransfer[] {
  // Filter active balances (ignoring small rounding noise < 1)
  const debtors: { id: string; name: string; balance: number }[] = [];
  const creditors: { id: string; name: string; balance: number }[] = [];

  for (const p of participants) {
    if (p.netBalance < -0.01) {
      debtors.push({ id: p.id, name: p.name, balance: Math.abs(p.netBalance) });
    } else if (p.netBalance > 0.01) {
      creditors.push({ id: p.id, name: p.name, balance: p.netBalance });
    }
  }

  // Sort descending by amount
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transfers: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amount = Math.min(debtor.balance, creditor.balance);
    const roundedAmount = Math.round(amount);

    if (roundedAmount > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: roundedAmount,
      });
    }

    debtor.balance -= amount;
    creditor.balance -= amount;

    if (debtor.balance < 0.01) {
      dIdx++;
    }
    if (creditor.balance < 0.01) {
      cIdx++;
    }
  }

  return transfers;
}
