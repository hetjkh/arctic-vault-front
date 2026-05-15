/* eslint-disable no-console */
/**
 * Allowance audit — uses the same calcAllowanceState as the dashboard.
 * Run: npx tsx scripts/allowance-audit.ts
 */
import { calcAllowanceState, calcFounderBalance, calcFinanceBreakdown, COMPANY_BANK_MIN } from '../lib/calculations';
import { mapBackendToDbData, type BackendSettlement, type BackendTx, type BackendUser } from '../lib/mapBackendToDbData';

const DEFAULT_BACKEND_URL = 'https://arctic-vault-back.onrender.com';
const BACKEND_URL = String(process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} failed: ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  console.log(`Backend: ${BACKEND_URL}`);

  const [users, transactions, settlements] = await Promise.all([
    getJson<BackendUser[]>('/api/users'),
    getJson<BackendTx[]>('/api/transactions'),
    getJson<BackendSettlement[]>('/api/settlements'),
  ]);

  const { data } = mapBackendToDbData(users, transactions, settlements);
  const allowance = calcAllowanceState(data, COMPANY_BANK_MIN);
  const fb = calcFinanceBreakdown(data);

  console.log('\n--- Totals ---');
  console.log('Total income:', formatINR(fb.companyTotalIncome));
  console.log('Total expense:', formatINR(fb.totalExpenses));
  console.log('Total personal:', formatINR(fb.totalPersonalAllFounders));

  console.log('\n--- Founder balances (ledger) ---');
  for (const u of data.users) {
    const b = calcFounderBalance(u.id, data);
    console.log(`\n${u.fullName || u.name}`);
    console.log('  Income credited:', formatINR(b.incomeCredited));
    console.log('  Expense share:', formatINR(b.totalSharedExpenses / 2));
    console.log('  Personal:', formatINR(b.totalPersonalWithdrawals));
    console.log('  Balance:', formatINR(b.balance));
  }

  console.log('\n--- Bank minimum ---');
  console.log('Company bank:', formatINR(allowance.companyBank));
  console.log('Minimum:', formatINR(allowance.bankMin));
  console.log('Below minimum:', formatINR(allowance.bankDeficit));
  console.log('Pool above minimum:', formatINR(allowance.poolAboveMin));

  console.log('\n--- Allowance buckets (new rules) ---');
  for (const f of allowance.founders) {
    console.log(`  ${f.name}: ${formatINR(f.allowanceLeft)}`);
  }
}

main().catch((err) => {
  console.error('\nAudit failed:\n', err);
  process.exitCode = 1;
});
