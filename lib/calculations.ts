import { DBData, FounderBalance, Settlement, Transaction } from '@/types';

/** Company bank must stay at or above this amount before founders get spendable allowance. */
export const COMPANY_BANK_MIN = 50000;

/** Round to 2 decimal places to avoid floating-point drift */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

function poolAboveMin(companyBank: number, bankMin: number): number {
  return r(Math.max(0, companyBank - bankMin));
}

export interface FounderAllowance {
  userId: number;
  name: string;
  allowanceLeft: number;
}

export interface AllowanceState {
  companyBank: number;
  bankMin: number;
  bankDeficit: number;
  poolAboveMin: number;
  founders: FounderAllowance[];
  byUserId: Map<number, FounderAllowance>;
}

type ChronologicalEvent =
  | { date: string; kind: 'tx'; tx: Transaction }
  | { date: string; kind: 'settlement'; settlement: Settlement };

function mergeChronologicalEvents(data: DBData): ChronologicalEvent[] {
  const events: ChronologicalEvent[] = [
    ...data.transactions.map((tx) => ({ date: tx.date, kind: 'tx' as const, tx })),
    ...data.settlements.map((settlement) => ({ date: settlement.date, kind: 'settlement' as const, settlement })),
  ];
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

function sumLedger(ledger: Map<string, number>): number {
  let total = 0;
  ledger.forEach((v) => {
    total = r(total + v);
  });
  return total;
}

function applyPoolDeltaToBuckets(
  bankBefore: number,
  bankAfter: number,
  bankMin: number,
  buckets: Map<string, number>,
  userIds: (number | string)[]
): void {
  const delta = r(poolAboveMin(bankAfter, bankMin) - poolAboveMin(bankBefore, bankMin));
  if (delta === 0 || userIds.length === 0) return;
  const share = r(delta / userIds.length);
  userIds.forEach((id) => {
    const k = userKey(id);
    buckets.set(k, r((buckets.get(k) ?? 0) + share));
  });
}

/**
 * Allowance buckets (processed in date order):
 * - Shared income: each founder gets half of any *new* pool above the bank minimum.
 * - Expenses: affect ledger/company bank only (do not change allowance buckets).
 * - Personal: only that founder's bucket decreases; partner unchanged.
 * - Founder-only income: adds to that founder's allowance bucket (clears debt, surplus stays positive); not split to partner.
 * - Settlements: adjust ledger only, not allowance buckets.
 */
function userKey(id: number | string): string {
  return String(id);
}

export function calcAllowanceState(data: DBData, bankMin: number = COMPANY_BANK_MIN): AllowanceState {
  const users = data.users;
  const userIds = users.map((u) => u.id);
  const n = userIds.length || 1;

  const ledger = new Map<string, number>();
  const buckets = new Map<string, number>();
  userIds.forEach((id) => {
    const k = userKey(id);
    ledger.set(k, 0);
    buckets.set(k, 0);
  });

  const events = mergeChronologicalEvents(data);

  for (const event of events) {
    if (event.kind === 'settlement') {
      const { fromUserId, toUserId, amount } = event.settlement;
      const fromK = userKey(fromUserId);
      const toK = userKey(toUserId);
      ledger.set(fromK, r((ledger.get(fromK) ?? 0) - amount));
      ledger.set(toK, r((ledger.get(toK) ?? 0) + amount));
      continue;
    }

    const tx = event.tx;
    const bankBefore = sumLedger(ledger);

    if (tx.type === 'income') {
      if (isSoleFounderIncome(tx)) {
        const uk = userKey(tx.incomeFromUserId!);
        ledger.set(uk, r((ledger.get(uk) ?? 0) + tx.amount));
        buckets.set(uk, r((buckets.get(uk) ?? 0) + tx.amount));
      } else {
        const half = r(tx.amount / n);
        userIds.forEach((id) => {
          const k = userKey(id);
          ledger.set(k, r((ledger.get(k) ?? 0) + half));
        });
        const bankAfter = sumLedger(ledger);
        applyPoolDeltaToBuckets(bankBefore, bankAfter, bankMin, buckets, userIds);
      }
      continue;
    }

    if (tx.type === 'expense') {
      const half = r(tx.amount / n);
      userIds.forEach((id) => {
        const k = userKey(id);
        ledger.set(k, r((ledger.get(k) ?? 0) - half));
      });
      continue;
    }

    if (tx.type === 'personal' && tx.userId != null) {
      const uk = userKey(tx.userId);
      ledger.set(uk, r((ledger.get(uk) ?? 0) - tx.amount));
      buckets.set(uk, r((buckets.get(uk) ?? 0) - tx.amount));
    }
  }

  const founderBalances = userIds.map((id) => calcFounderBalance(id, data));
  const companyBank = r(founderBalances.reduce((s, b) => r(s + b.balance), 0));
  const poolAbove = poolAboveMin(companyBank, bankMin);
  const bankDeficit = r(Math.max(0, bankMin - companyBank));

  const founders: FounderAllowance[] = users.map((u) => {
    const id = Number(u.id);
    return {
      userId: id,
      name: u.name || u.fullName || 'User',
      allowanceLeft: buckets.get(userKey(u.id)) ?? 0,
    };
  });

  const byUserId = new Map<number, FounderAllowance>();
  founders.forEach((f) => byUserId.set(f.userId, f));

  return {
    companyBank,
    bankMin,
    bankDeficit,
    poolAboveMin: poolAbove,
    founders,
    byUserId,
  };
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
