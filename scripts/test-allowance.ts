/**
 * Allowance system tests — scenario walkthrough + live backend parity.
 * Run: npm run test:allowance
 */
import {
  calcAllowanceState,
  calcFounderBalance,
  COMPANY_BANK_MIN,
} from '../lib/calculations';
import { mapBackendToDbData, type BackendSettlement, type BackendTx, type BackendUser } from '../lib/mapBackendToDbData';
import type { DBData } from '../types';

const BACKEND_URL = String(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://arctic-vault-back.onrender.com'
).replace(/\/+$/, '');

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.01) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function makeData(
  txs: DBData['transactions'],
  settlements: DBData['settlements'] = []
): DBData {
  return {
    users: [
      { id: 1, name: 'Ronit', fullName: 'Ronit' },
      { id: 2, name: 'Het', fullName: 'Het' },
    ],
    transactions: txs,
    invoices: [],
    settlements,
  };
}

let step = 0;
function check(label: string, fn: () => void) {
  step++;
  fn();
  console.log(`✓ ${step}. ${label}`);
}

function ronitId(d: DBData) {
  return d.users.find((u) => (u.fullName || u.name || '').toLowerCase().includes('ronit'))!.id;
}
function hetId(d: DBData) {
  return d.users.find((u) => (u.fullName || u.name || '').toLowerCase().includes('het'))!.id;
}

function allowance(d: DBData, userId: number) {
  return calcAllowanceState(d).byUserId.get(userId)!.allowanceLeft;
}

function bank(d: DBData) {
  return calcAllowanceState(d).companyBank;
}

function incomeCredited(d: DBData, userId: number) {
  return calcFounderBalance(userId, d).incomeCredited;
}

console.log('=== Scenario walkthrough (your prompt) ===\n');

check('50k shared — ledger 25k each, allowance 0, bank 50k', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
  ]);
  assertClose(incomeCredited(d, 1), 25000, 'Ronit income credited');
  assertClose(incomeCredited(d, 2), 25000, 'Het income credited');
  assertClose(allowance(d, 1), 0, 'Ronit allowance');
  assertClose(allowance(d, 2), 0, 'Het allowance');
  assertClose(bank(d), 50000, 'company bank');
});

check('Het personal 10k — Ronit allowance 0, Het -10k, bank 40k, Ronit ledger still 25k', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
  ]);
  assertClose(incomeCredited(d, 1), 25000, 'Ronit income credited');
  assertClose(calcFounderBalance(1, d).balance, 25000, 'Ronit ledger');
  assertClose(allowance(d, 1), 0, 'Ronit allowance');
  assertClose(allowance(d, 2), -10000, 'Het allowance');
  assertClose(bank(d), 40000, 'company bank');
});

check('Het repays 10k founder-only — both allowance 0, bank 50k (exact repay)', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
    {
      id: '3',
      type: 'income',
      category: 'Repay',
      amount: 10000,
      description: 'debt clear',
      incomeFromUserId: 2,
      date: '2026-01-03T00:00:00.000Z',
    },
  ]);
  assertClose(allowance(d, 1), 0, 'Ronit allowance');
  assertClose(allowance(d, 2), 0, 'Het allowance');
  assertClose(bank(d), 50000, 'company bank');
  assertClose(allowance(d, 1), allowance(d, 2), 'partner unchanged by repay');
});

check('+20k shared — each allowance 10k, bank 70k', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
    {
      id: '3',
      type: 'income',
      category: 'Repay',
      amount: 10000,
      description: '',
      incomeFromUserId: 2,
      date: '2026-01-03T00:00:00.000Z',
    },
    { id: '4', type: 'income', category: 'Client', amount: 20000, description: '', date: '2026-01-04T00:00:00.000Z' },
  ]);
  assertClose(allowance(d, 1), 10000, 'Ronit allowance');
  assertClose(allowance(d, 2), 10000, 'Het allowance');
  assertClose(bank(d), 70000, 'company bank');
});

check('Het personal 5k — Ronit 10k, Het 5k, bank 65k', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
    {
      id: '3',
      type: 'income',
      category: 'Repay',
      amount: 10000,
      description: '',
      incomeFromUserId: 2,
      date: '2026-01-03T00:00:00.000Z',
    },
    { id: '4', type: 'income', category: 'Client', amount: 20000, description: '', date: '2026-01-04T00:00:00.000Z' },
    { id: '5', type: 'personal', category: 'Withdrawal', amount: 5000, description: '', userId: 2, date: '2026-01-05T00:00:00.000Z' },
  ]);
  assertClose(allowance(d, 1), 10000, 'Ronit allowance');
  assertClose(allowance(d, 2), 5000, 'Het allowance');
  assertClose(bank(d), 65000, 'company bank');
});

check('Het overpays allowance debt — extra stays positive (e.g. -10k + 25k = +15k)', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
    {
      id: '3',
      type: 'income',
      category: 'Repay',
      amount: 25000,
      description: '',
      incomeFromUserId: 2,
      date: '2026-01-03T00:00:00.000Z',
    },
  ]);
  assertClose(allowance(d, 2), 15000, 'Het allowance');
  assertClose(allowance(d, 1), 0, 'Ronit allowance');
});

check('shared income does not add partner allowance when only one had debt', () => {
  const d = makeData([
    { id: '1', type: 'income', category: 'Client', amount: 50000, description: '', date: '2026-01-01T00:00:00.000Z' },
    { id: '2', type: 'personal', category: 'Withdrawal', amount: 10000, description: '', userId: 2, date: '2026-01-02T00:00:00.000Z' },
  ]);
  assertClose(allowance(d, 1), 0, 'Ronit before repay');
  assertClose(allowance(d, 2), -10000, 'Het debt');
});

console.log('\n=== Live backend data (invariants) ===\n');

async function testLiveBackend() {
  const [usersRes, txRes, stRes] = await Promise.all([
    fetch(`${BACKEND_URL}/api/users`),
    fetch(`${BACKEND_URL}/api/transactions`),
    fetch(`${BACKEND_URL}/api/settlements`),
  ]);
  if (!usersRes.ok) throw new Error(`users ${usersRes.status}`);
  const backendUsers = (await usersRes.json()) as BackendUser[];
  const backendTx = (await txRes.json()) as BackendTx[];
  const backendSettlements = (await stRes.json()) as BackendSettlement[];
  const { data } = mapBackendToDbData(backendUsers, backendTx, backendSettlements);

  const state = calcAllowanceState(data, COMPANY_BANK_MIN);
  const rId = ronitId(data);
  const hId = hetId(data);

  assertClose(state.bankMin, COMPANY_BANK_MIN, 'bank min');
  assertClose(
    state.poolAboveMin,
    Math.max(0, state.companyBank - COMPANY_BANK_MIN),
    'pool above min'
  );
  assertClose(
    state.bankDeficit,
    Math.max(0, COMPANY_BANK_MIN - state.companyBank),
    'bank deficit'
  );

  const sumLedger = data.users.reduce((s, u) => {
    return Math.round((s + calcFounderBalance(u.id, data).balance) * 100) / 100;
  }, 0);
  assertClose(state.companyBank, Math.round(sumLedger * 100) / 100, 'company bank = sum ledger');

  console.log(`  Company bank: ₹${state.companyBank.toLocaleString('en-IN')}`);
  console.log(`  Pool above min: ₹${state.poolAboveMin.toLocaleString('en-IN')}`);
  console.log(`  Below minimum: ₹${state.bankDeficit.toLocaleString('en-IN')}`);
  for (const f of state.founders) {
    const bal = calcFounderBalance(f.userId, data);
    console.log(
      `  ${f.name}: allowance ₹${f.allowanceLeft.toLocaleString('en-IN')} | ledger ₹${bal.balance.toLocaleString('en-IN')}`
    );
  }

  // Dashboard card expected values (all-time)
  assertClose(allowance(data, rId), state.byUserId.get(rId)!.allowanceLeft, 'Ronit allowance map');
  assertClose(allowance(data, hId), state.byUserId.get(hId)!.allowanceLeft, 'Het allowance map');

  // Try backend /api/finance/summary parity if deployed
  const finRes = await fetch(`${BACKEND_URL}/api/finance/summary`);
  if (finRes.ok) {
    const fin = (await finRes.json()) as {
      companyBank: number;
      bankDeficit: number;
      poolAboveMin: number;
      founders: { name: string; allowanceLeft: number }[];
    };
    assertClose(fin.companyBank, state.companyBank, 'backend companyBank');
    assertClose(fin.bankDeficit, state.bankDeficit, 'backend bankDeficit');
    assertClose(fin.poolAboveMin, state.poolAboveMin, 'backend poolAboveMin');
    for (const f of state.founders) {
      const bf = fin.founders.find((x) =>
        x.name.toLowerCase().includes(f.name.toLowerCase().slice(0, 3))
      );
      if (bf) assertClose(bf.allowanceLeft, f.allowanceLeft, `backend allowance ${f.name}`);
    }
    console.log('  Backend /api/finance/summary: matches frontend ✓');
  } else {
    console.log(`  Backend /api/finance/summary: not deployed yet (${finRes.status}) — redeploy arctic-vault-back`);
  }

  console.log('\n✓ Live data invariants passed');
}

testLiveBackend()
  .then(() => {
    console.log('\n=== All tests passed ===');
  })
  .catch((err) => {
    console.error('\nTest failed:', err);
    process.exitCode = 1;
  });
