'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark, Users, Wallet, Receipt, Sparkles } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { BACKEND_URL } from '@/lib/backend';
import {
  calcFinanceBreakdown,
  calcFounderBalance,
  calcAllowanceState,
  COMPANY_BANK_MIN,
  formatCurrency,
} from '@/lib/calculations';
import { mapBackendToDbData, type BackendSettlement, type BackendTx, type BackendUser } from '@/lib/mapBackendToDbData';
import type { DBData } from '@/types';

const BANK_MIN = COMPANY_BANK_MIN;

function money(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function StepBadge({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: 'linear-gradient(135deg,#00ff41,#00aa33)',
          color: '#000',
          fontSize: 16,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>{title}</h2>
    </div>
  );
}

function PlainBox({
  children,
  border = 'rgba(255,255,255,0.1)',
  bg = 'rgba(255,255,255,0.04)',
}: {
  children: ReactNode;
  border?: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${border}`,
        background: bg,
        padding: '20px 22px',
      }}
    >
      {children}
    </div>
  );
}

export default function MoneyGuidePage() {
  const router = useRouter();
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      setError('');
      try {
        const [usersRes, txRes, stRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/users`),
          fetch(`${BACKEND_URL}/api/transactions`),
          fetch(`${BACKEND_URL}/api/settlements`),
        ]);
        const backendUsers = (await usersRes.json()) as BackendUser[];
        const backendTx = (await txRes.json()) as BackendTx[];
        const backendSettlements = (await stRes.json()) as BackendSettlement[];
        const { data: mapped } = mapBackendToDbData(backendUsers, backendTx, backendSettlements);
        setData(mapped);
      } catch {
        setError('Could not load your numbers. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508' }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Loading the simple guide…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
        <p style={{ color: '#ff6b8a' }}>{error || 'No data.'}</p>
        <Link href="/dashboard" style={{ color: '#00ff41' }}>Back to dashboard</Link>
      </div>
    );
  }

  const fb = calcFinanceBreakdown(data);
  const founderRows = data.users.map((u) => ({
    user: u,
    bal: calcFounderBalance(u.id, data),
  }));
  const allowanceState = calcAllowanceState(data, BANK_MIN);
  const companyBank = allowanceState.companyBank;
  const bankGap = allowanceState.bankDeficit;

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg,#050508 0%,#0a0c12 40%,#050508 100%)', padding: '20px 18px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Plain English
            </p>
            <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>How your money is counted</h1>
          </div>
        </div>

        <PlainBox border="rgba(0,255,65,0.25)" bg="rgba(0,255,65,0.06)">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Sparkles size={22} color="#00ff41" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.88)' }}>
              <strong style={{ color: '#fff' }}>Read top to bottom.</strong> Each step uses only the numbers from your saved transactions.
              Nothing here is hidden math — it is the same rules as the rest of the app.
            </p>
          </div>
        </PlainBox>

        <div style={{ height: 22 }} />

        <StepBadge n={1} title="How much money came into the company?" />
        <PlainBox>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Landmark size={20} color="#00ff41" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Total income (all “income” entries)</span>
          </div>
          <p style={{ margin: 0, fontSize: 40, fontWeight: 900, color: '#00ff41', letterSpacing: -1 }}>{money(fb.companyTotalIncome)}</p>
          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.55)' }}>
            This is simply every rupee you recorded as <strong style={{ color: '#fff' }}>income</strong>, added together.
          </p>
        </PlainBox>

        <div style={{ height: 28 }} />

        <StepBadge n={2} title="Two different kinds of income" />
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>
          Some income is <strong style={{ color: '#fff' }}>for both of you</strong>. Some income is <strong style={{ color: '#fff' }}>only one person’s deposit</strong> (for example putting money back after a personal withdrawal).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <PlainBox border="rgba(0,255,65,0.2)" bg="rgba(0,255,65,0.05)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={18} color="#00ff41" />
              <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>A) Normal income (split 50 / 50)</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
              Think: client payments, revenue — money that belongs to the <em>business</em>, not tagged to one founder.
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Pool to split</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff' }}>{money(fb.splitIncomePool)}</p>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Each founder is counted as receiving half of that pool:</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#00ff41' }}>{money(fb.incomeHalfFromSharedEach)} <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>each</span></p>
            </div>
          </PlainBox>

          <PlainBox border="rgba(120,200,255,0.3)" bg="rgba(120,200,255,0.07)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Wallet size={18} color="#7ec8ff" />
              <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>B) One founder only (not split)</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
              When you add income and choose <strong style={{ color: '#7ec8ff' }}>“full amount to one person only”</strong>, that whole amount counts only for that person — <strong style={{ color: '#fff' }}>no 50/50</strong>.
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Total of these entries</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#7ec8ff' }}>{money(fb.founderOnlyIncomeTotal)}</p>
            {fb.founderOnlyIncomePerUser.length === 0 ? (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>You have not used this type yet — that is OK.</p>
            ) : (
              <ul style={{ margin: '14px 0 0', paddingLeft: 18, color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.7 }}>
                {fb.founderOnlyIncomePerUser.map((x) => (
                  <li key={x.userId}>
                    <strong style={{ color: '#fff' }}>{x.name}</strong> — {money(x.amount)} (all of this is theirs in the ledger)
                  </li>
                ))}
              </ul>
            )}
          </PlainBox>
        </div>

        <div style={{ height: 28 }} />

        <StepBadge n={3} title="Shared bills (expenses) — always 50 / 50" />
        <PlainBox border="rgba(255,0,51,0.25)" bg="rgba(255,0,51,0.06)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Receipt size={18} color="#ff6b8a" />
            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Company expenses</span>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
            Every <strong style={{ color: '#fff' }}>expense</strong> row is treated as a cost shared by the business. In the ledger, <strong style={{ color: '#fff' }}>each founder pays half</strong>.
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Total expenses</p>
          <p style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 900, color: '#ff6b8a' }}>{money(fb.totalExpenses)}</p>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Each founder’s share (50%)</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#ff6b8a' }}>{money(fb.expenseShareEach)} <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>each</span></p>
        </PlainBox>

        <div style={{ height: 28 }} />

        <StepBadge n={4} title="Personal withdrawals — not split" />
        <PlainBox>
          <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>
            <strong style={{ color: '#fff' }}>Personal</strong> means: cash that one founder took for themselves. It does <strong style={{ color: '#fff' }}>not</strong> get divided 50/50 — it only reduces that one person in the ledger.
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Everyone’s personal withdrawals added up</p>
          <p style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 900, color: '#fff' }}>{money(fb.totalPersonalAllFounders)}</p>
          {fb.personalPerUser.map((p) => (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{p.name}</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: p.amount > 0 ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                {money(p.amount)}
              </span>
            </div>
          ))}
        </PlainBox>

        <div style={{ height: 28 }} />

        <StepBadge n={5} title="Each person’s “balance” in one line" />
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.55)' }}>
          For each founder we do this in words:
        </p>
        <PlainBox bg="rgba(255,255,255,0.03)">
          <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,0.65)' }}>
            (money counted as <strong style={{ color: '#00ff41' }}>income for you</strong>)
            <br />
            − (your <strong style={{ color: '#ff6b8a' }}>half of all expenses</strong>)
            <br />
            − (your <strong style={{ color: '#fff' }}>personal withdrawals</strong>)
            <br />
            + (any <strong style={{ color: '#fff' }}>settlements</strong> you paid or received)
            <br />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>= your balance</span>
          </p>
        </PlainBox>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 16 }}>
          {founderRows.map(({ user, bal }) => (
            <PlainBox key={user.id} border="rgba(255,255,255,0.12)">
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{user.fullName || user.name}</p>
              <p style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 900, color: bal.balance >= 0 ? '#00ff41' : '#ff6b8a' }}>{formatCurrency(bal.balance)}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Income counted for you</div>
                  <div style={{ fontWeight: 800, color: '#00ff41' }}>{formatCurrency(bal.incomeCredited)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Your half of expenses</div>
                  <div style={{ fontWeight: 800, color: '#ff6b8a' }}>{formatCurrency(bal.totalSharedExpenses / 2)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Your personal</div>
                  <div style={{ fontWeight: 800, color: '#fff' }}>{formatCurrency(bal.totalPersonalWithdrawals)}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 10 }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Settlements (net)</div>
                  <div style={{ fontWeight: 800, color: 'rgba(255,255,255,0.75)' }}>{formatCurrency(bal.settlementsReceived - bal.settlementsPaid)}</div>
                </div>
              </div>
            </PlainBox>
          ))}
        </div>

        <div style={{ height: 28 }} />

        <StepBadge n={6} title="Allowance — what each founder can still take personally" />
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>
          The first <strong style={{ color: '#fff' }}>₹50,000</strong> in the company bank is locked. Only money <em>above</em> that becomes allowance, split <strong style={{ color: '#fff' }}>50/50</strong> when new shared income arrives.
          If you take personal money and drop the bank below ₹50k, <strong style={{ color: '#fff' }}>only you</strong> get a negative allowance until you repay with <strong style={{ color: '#7ec8ff' }}>founder-only income</strong> (not split). Company expenses change the ledger but do not touch your partner&apos;s allowance.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {allowanceState.founders.map((f) => (
            <PlainBox key={f.userId} border="rgba(255,255,255,0.12)">
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{f.name}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: f.allowanceLeft < 0 ? '#ff6b8a' : f.allowanceLeft > 0 ? '#00ff41' : 'rgba(255,255,255,0.5)' }}>
                {money(f.allowanceLeft)}
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>allowance left</p>
            </PlainBox>
          ))}
        </div>

        <div style={{ height: 16 }} />

        <StepBadge n={7} title="Bank total vs minimum (₹50,000)" />
        <PlainBox>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.55)' }}>
            Ronit balance + Het balance = company bank.
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Company bank</p>
          <p style={{ margin: '0 0 14px', fontSize: 26, fontWeight: 900, color: '#fff' }}>{money(companyBank)}</p>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Pool above minimum (split 50/50 for allowance)</p>
          <p style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800, color: allowanceState.poolAboveMin > 0 ? '#00ff41' : 'rgba(255,255,255,0.75)' }}>
            {money(allowanceState.poolAboveMin)}
          </p>
          {bankGap > 0 ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#ff6b8a', fontWeight: 700 }}>
              You are <strong>{money(bankGap)}</strong> below the minimum. Repay with founder-only income or add shared income.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: '#00ff41', fontWeight: 700 }}>At or above the ₹50,000 minimum.</p>
          )}
        </PlainBox>

        <div style={{ height: 28 }} />
        <Link
          href="/dashboard"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '16px',
            borderRadius: 16,
            background: '#00ff41',
            color: '#000',
            fontWeight: 900,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
