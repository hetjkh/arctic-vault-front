import { DBData, FounderBalance } from '@/types';

/** Round to 2 decimal places to avoid floating-point drift */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/** IDs from JSON/API may be number or string; strict `===` misses personal tx attribution. */
function sameUserId(a: number | string | undefined | null, b: number): boolean {
  if (a == null) return false;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

export function calcFounderBalance(userId: number, data: DBData): FounderBalance {
  const user = data.users.find((u) => Number(u.id) === Number(userId));

  const totalIncome = data.transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => r(sum + t.amount), 0);

  const totalSharedExpenses = data.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => r(sum + t.amount), 0);

  const totalPersonalWithdrawals = data.transactions
    .filter((t) => t.type === 'personal' && sameUserId(t.userId, userId))
    .reduce((sum, t) => r(sum + t.amount), 0);

  const settlementsReceived = data.settlements
    .filter((s) => sameUserId(s.toUserId, userId))
    .reduce((sum, s) => r(sum + s.amount), 0);

  const settlementsPaid = data.settlements
    .filter((s) => sameUserId(s.fromUserId, userId))
    .reduce((sum, s) => r(sum + s.amount), 0);

  // Use individual rounded halves to avoid e.g. 100.005 floating-point drift
  const incomeShare   = r(totalIncome / 2);
  const expenseShare  = r(totalSharedExpenses / 2);

  const balance = r(
    incomeShare -
    expenseShare -
    totalPersonalWithdrawals +
    settlementsReceived -
    settlementsPaid
  );

  return {
    userId,
    // Avoid runtime crash if a stale/invalid session userId is passed.
    name: user?.name ?? user?.fullName ?? 'Unknown User',
    totalIncome,
    totalSharedExpenses,
    totalPersonalWithdrawals,
    settlementsReceived,
    settlementsPaid,
    balance,
  };
}

export function calcNetProfit(data: DBData): number {
  const totalIncome = data.transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => r(sum + t.amount), 0);
  const totalExpenses = data.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => r(sum + t.amount), 0);
  return r(totalIncome - totalExpenses);
}

export function calcTotalRevenue(data: DBData): number {
  return data.transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => r(sum + t.amount), 0);
}

export function calcTotalExpenses(data: DBData): number {
  return data.transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => r(sum + t.amount), 0);
}

export interface SettlementSuggestion {
  fromName: string;
  toName: string;
  fromUserId: number;
  toUserId: number;
  amount: number;
}

export function calcSettlementSuggestion(
  balances: FounderBalance[]
): SettlementSuggestion | null {
  if (balances.length < 2) return null;

  // For a two-founder split this equalizes exactly; for more founders this is a best-effort
  // suggestion between the max positive and max negative balances.
  const payer = balances.reduce((max, b) => (b.balance > max.balance ? b : max), balances[0]);
  const receiver = balances.reduce((min, b) => (b.balance < min.balance ? b : min), balances[0]);

  const diff = r(Math.abs(payer.balance - receiver.balance));
  if (diff < 1) return null; // already settled within ₹1

  const payAmount = r(diff / 2);

  return {
    fromName: payer.name,
    toName: receiver.name,
    fromUserId: payer.userId,
    toUserId: receiver.userId,
    amount: payAmount,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompact(amount: number): string {
  const abs  = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  return formatCurrency(amount);
}
