/* eslint-disable no-console */
/**
 * Allowance audit script
 *
 * Fetches /api/users, /api/transactions, /api/settlements from BACKEND_URL and prints:
 * - per-founder ledger balance (income/2 - expense/2 - personal + settlements)
 * - company bank, min balance deficit/pool
 * - per-founder allowance remaining (pool + totalPersonal)/2 - personal
 *
 * Usage (PowerShell):
 *   node scripts/allowance-audit.mjs
 *
 * Optional:
 *   $env:NEXT_PUBLIC_BACKEND_URL="http://localhost:4000"
 */

const DEFAULT_BACKEND_URL = 'https://arctic-vault-back.onrender.com';
const BACKEND_URL = String(process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

const BANK_MIN = 50000;

function r2(n) {
  return Math.round(n * 100) / 100;
}

function formatINR(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function isSoleFounderIncome(t) {
  return t.type === 'income' && t.incomeFromUserId != null && String(t.incomeFromUserId).length > 0;
}

async function getJson(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} failed: ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

function sumAmounts(items) {
  return r2(items.reduce((s, x) => r2(s + Number(x.amount || 0)), 0));
}

function calcFounderBalance(userId, data) {
  const incomeTxs = data.transactions.filter((t) => t.type === 'income');
  const totalIncome = sumAmounts(incomeTxs);
  const isSoleFounderIncome = (t) =>
    t.incomeFromUserId != null && String(t.incomeFromUserId).length > 0;
  const splitPool = sumAmounts(incomeTxs.filter((t) => !isSoleFounderIncome(t)));
  const soleForUser = sumAmounts(
    incomeTxs.filter((t) => isSoleFounderIncome(t) && sameId(t.incomeFromUserId, userId))
  );
  const incomeCredited = r2(r2(splitPool / 2) + soleForUser);

  const totalSharedExpenses = sumAmounts(data.transactions.filter((t) => t.type === 'expense'));
  const totalPersonalWithdrawals = sumAmounts(
    data.transactions.filter((t) => t.type === 'personal' && sameId(t.userId, userId))
  );
  const settlementsReceived = sumAmounts(data.settlements.filter((s) => sameId(s.toUserId, userId)));
  const settlementsPaid = sumAmounts(data.settlements.filter((s) => sameId(s.fromUserId, userId)));

  const expenseShare = r2(totalSharedExpenses / 2);
  const balance = r2(incomeCredited - expenseShare - totalPersonalWithdrawals + settlementsReceived - settlementsPaid);

  return {
    userId,
    totalIncome,
    incomeCredited,
    totalSharedExpenses,
    totalPersonalWithdrawals,
    settlementsReceived,
    settlementsPaid,
    incomeShare: incomeCredited,
    expenseShare,
    settlementsNet: r2(settlementsReceived - settlementsPaid),
    balance,
  };
}

function pickFounder(users, needle) {
  const n = String(needle).toLowerCase();
  return users.find((u) => String(u.fullName || u.username || '').toLowerCase().includes(n));
}

async function main() {
  console.log(`Backend: ${BACKEND_URL}`);

  const [users, transactions, settlements] = await Promise.all([
    getJson('/api/users'),
    getJson('/api/transactions'),
    getJson('/api/settlements'),
  ]);

  const data = { users, transactions, settlements };

  const ronit = pickFounder(users, 'ronit');
  const het = pickFounder(users, 'het');

  const balances = users.map((u) => ({
    user: u,
    ...calcFounderBalance(u.id, data),
  }));

  const companyBank = r2(balances.reduce((s, b) => r2(s + b.balance), 0));
  const bankDeficit = r2(Math.max(0, BANK_MIN - companyBank));
  const currentPool = r2(Math.max(0, companyBank - BANK_MIN));

  const totalPersonal = r2(balances.reduce((s, b) => r2(s + b.totalPersonalWithdrawals), 0));
  const allocatedEach = r2((currentPool + totalPersonal) / 2);

  function remainingAllowance(userId) {
    const b = balances.find((x) => sameId(x.userId, userId));
    const personal = b ? b.totalPersonalWithdrawals : 0;
    return r2(allocatedEach - personal);
  }

  console.log('\n--- Totals ---');
  const totalIncome = sumAmounts(transactions.filter((t) => t.type === 'income'));
  const totalExpense = sumAmounts(transactions.filter((t) => t.type === 'expense'));
  const totalPersonalTx = sumAmounts(transactions.filter((t) => t.type === 'personal'));
  console.log('Total income:', formatINR(totalIncome));
  console.log('Total expense:', formatINR(totalExpense));
  console.log('Total personal:', formatINR(totalPersonalTx));
  console.log('Total settlements:', formatINR(sumAmounts(settlements)));

  const incomeTxs = transactions.filter((t) => t.type === 'income');
  const splitPool = sumAmounts(incomeTxs.filter((t) => !isSoleFounderIncome(t)));
  const founderOnlyTotal = sumAmounts(incomeTxs.filter((t) => isSoleFounderIncome(t)));
  console.log('\n--- Full ledger (company income, withdrawals, 50/50) ---');
  console.log('Total income into company (all income rows):', formatINR(totalIncome));
  console.log('Shared income pool (50/50, not founder-only):', formatINR(splitPool));
  console.log('Each founder from shared income (50%):', formatINR(r2(splitPool / 2)));
  console.log('Founder-only income total (100% to one founder):', formatINR(founderOnlyTotal));
  for (const u of users) {
    const amt = sumAmounts(incomeTxs.filter((t) => isSoleFounderIncome(t) && sameId(t.incomeFromUserId, u.id)));
    if (amt > 0) console.log(`  -> ${u.fullName || u.username} only:`, formatINR(amt));
  }
  if (founderOnlyTotal === 0) console.log('  (no founder-only income rows)');
  console.log('Total company expenses (shared):', formatINR(totalExpense));
  console.log('Each founder expense share (50%):', formatINR(r2(totalExpense / 2)));
  console.log('Personal withdrawals by founder:');
  for (const u of users) {
    const w = sumAmounts(transactions.filter((t) => t.type === 'personal' && sameId(t.userId, u.id)));
    console.log(`  ${u.fullName || u.username}:`, formatINR(w));
  }
  console.log('\n--- Founder balances (ledger) ---');
  for (const b of balances) {
    console.log(`\n${b.user.fullName || b.user.username} (${b.userId})`);
    console.log('Income credited:', formatINR(b.incomeShare));
    console.log('Expense share:', formatINR(b.expenseShare));
    console.log('Personal:', formatINR(b.totalPersonalWithdrawals));
    console.log('Settlements (net):', formatINR(b.settlementsNet));
    console.log('Balance:', formatINR(b.balance));
  }

  console.log('\n--- Minimum bank rule ---');
  console.log('Company bank (sum balances):', formatINR(companyBank));
  console.log('Minimum balance:', formatINR(BANK_MIN));
  console.log('Below minimum:', formatINR(bankDeficit));
  console.log('Pool above minimum:', formatINR(currentPool));

  console.log('\n--- Allowance distribution ---');
  console.log('Total personal (Ronit + Het + others):', formatINR(totalPersonal));
  console.log('Allocated per founder:', formatINR(allocatedEach));

  if (ronit) console.log('Ronit remaining allowance:', formatINR(remainingAllowance(ronit.id)));
  if (het) console.log('Het remaining allowance:', formatINR(remainingAllowance(het.id)));

  console.log('\n--- Raw counts ---');
  console.log('Users:', users.length);
  console.log('Transactions:', transactions.length);
  console.log('Settlements:', settlements.length);
}

main().catch((err) => {
  console.error('\nAudit failed:\n', err);
  process.exitCode = 1;
});

