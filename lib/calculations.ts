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

function isSoleFounderIncome(t: { type: string; incomeFromUserId?: number | string }): boolean {
  return t.type === 'income' && t.incomeFromUserId != null && String(t.incomeFromUserId).length > 0;
}

export interface FinanceBreakdown {
  /** Sum of all income transactions (cash in). */
  companyTotalIncome: number;
  /** Income that is split 50/50 between founders (no `incomeFromUserId`). */
  splitIncomePool: number;
  /** Each founder’s half of `splitIncomePool`. */
  incomeHalfFromSharedEach: number;
  /** Sum of income rows credited 100% to one founder. */
  founderOnlyIncomeTotal: number;
  /** Per-founder totals for founder-only income rows. */
  founderOnlyIncomePerUser: { userId: number; name: string; amount: number }[];
  /** Sum of all shared expense transactions. */
  totalExpenses: number;
  /** Each founder’s half of shared expenses. */
  expenseShareEach: number;
  /** Sum of all personal withdrawals. */
  totalPersonalAllFounders: number;
  /** Per-founder personal withdrawal totals. */
  personalPerUser: { userId: number; name: string; amount: number }[];
}

/**
 * Human-readable company ledger: total income, per-founder withdrawals, and 50/50 split lines.
 */
export function calcFinanceBreakdown(data: DBData): FinanceBreakdown {
  const incomeTxs = data.transactions.filter((t) => t.type === 'income');
  const companyTotalIncome = incomeTxs.reduce((sum, t) => r(sum + t.amount), 0);

  const splitIncomePool = incomeTxs
    .filter((t) => !isSoleFounderIncome(t))
    .reduce((sum, t) => r(sum + t.amount), 0);
  const incomeHalfFromSharedEach = r(splitIncomePool / 2);

  const founderOnlyTxs = incomeTxs.filter((t) => isSoleFounderIncome(t));
  const founderOnlyIncomeTotal = founderOnlyTxs.reduce((sum, t) => r(sum + t.amount), 0);

  const founderOnlyIncomePerUser = data.users
    .map((u) => {
      const amount = founderOnlyTxs
        .filter((t) => sameUserId(t.incomeFromUserId, u.id))
        .reduce((sum, t) => r(sum + t.amount), 0);
      return {
        userId: u.id,
        name: u.name || u.fullName || 'User',
        amount,
      };
    })
    .filter((x) => x.amount > 0);

  const expenseTxs = data.transactions.filter((t) => t.type === 'expense');
  const totalExpenses = expenseTxs.reduce((sum, t) => r(sum + t.amount), 0);
  const expenseShareEach = r(totalExpenses / 2);

  const personalPerUser = data.users.map((u) => {
    const amount = data.transactions
      .filter((t) => t.type === 'personal' && sameUserId(t.userId, u.id))
      .reduce((sum, t) => r(sum + t.amount), 0);
    return {
      userId: u.id,
      name: u.name || u.fullName || 'User',
      amount,
    };
  });
  const totalPersonalAllFounders = personalPerUser.reduce((s, p) => r(s + p.amount), 0);

  return {
    companyTotalIncome,
    splitIncomePool,
    incomeHalfFromSharedEach,
    founderOnlyIncomeTotal,
    founderOnlyIncomePerUser,
    totalExpenses,
    expenseShareEach,
    totalPersonalAllFounders,
    personalPerUser,
  };
}

export function calcFounderBalance(userId: number, data: DBData): FounderBalance {
  const user = data.users.find((u) => Number(u.id) === Number(userId));

  const incomeTxs = data.transactions.filter((t) => t.type === 'income');
  const totalIncome = incomeTxs.reduce((sum, t) => r(sum + t.amount), 0);

  const splitIncomePool = incomeTxs
    .filter((t) => !isSoleFounderIncome(t))
    .reduce((sum, t) => r(sum + t.amount), 0);

  const soleIncomeForUser = incomeTxs
    .filter((t) => isSoleFounderIncome(t) && sameUserId(t.incomeFromUserId, userId))
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

  // Split income 50/50; sole-founder income 100% to that founder only
  const incomeCredited = r(r(splitIncomePool / 2) + soleIncomeForUser);
  const expenseShare = r(totalSharedExpenses / 2);

  const balance = r(
    incomeCredited -
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
    incomeCredited,
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
