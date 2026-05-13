'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Users } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { BACKEND_URL } from '@/lib/backend';
import { formatCurrency } from '@/lib/calculations';
import { mapBackendToDbData, type BackendSettlement, type BackendTx, type BackendUser } from '@/lib/mapBackendToDbData';
import type { DBData, Transaction } from '@/types';
import TransactionItem from '@/components/TransactionItem';

function sameUserId(a: number | string | undefined | null, b: number): boolean {
  if (a == null) return false;
  return Number(a) === Number(b);
}

function isSoleFounderIncome(t: Transaction): boolean {
  return t.type === 'income' && t.incomeFromUserId != null && String(t.incomeFromUserId).length > 0;
}

function sortByDateDesc(a: Transaction, b: Transaction): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function findFounderId(users: DBData['users'], needle: string): number | undefined {
  const n = needle.toLowerCase();
  const u = users.find((x) => (x.fullName || x.name || '').toLowerCase().includes(n));
  return u?.id;
}

function sumAmount(txs: Transaction[]): number {
  return Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100;
}

function SectionShell({
  title,
  hint,
  count,
  totalLabel,
  totalAmount,
  accent,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  totalLabel: string;
  totalAmount: number;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        padding: '18px 18px 14px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: -0.3, color: '#fff' }}>{title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.45, color: 'rgba(255,255,255,0.45)', maxWidth: 520 }}>{hint}</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {count} {count === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{totalLabel}</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalAmount)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

export default function MoneyListsPage() {
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
        setError('Could not load transactions. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const session = getSession();
  const currentUserId = session?.id;

  const idToDisplay = useMemo(() => {
    if (!data) return {} as Record<string, string>;
    const m: Record<string, string> = {};
    data.users.forEach((u) => {
      m[String(u.id)] = (u.fullName || u.name || 'User').trim();
    });
    return m;
  }, [data]);

  const lists = useMemo(() => {
    if (!data) return null;

    const incomeAll = data.transactions.filter((t) => t.type === 'income').sort(sortByDateDesc);

    const ronitId = findFounderId(data.users, 'ronit') ?? data.users[0]?.id;
    const hetId = findFounderId(data.users, 'het') ?? data.users[1]?.id ?? data.users[0]?.id;

    const ronitPersonal =
      ronitId != null
        ? data.transactions.filter((t) => t.type === 'personal' && sameUserId(t.userId, ronitId)).sort(sortByDateDesc)
        : [];
    const hetPersonal =
      hetId != null
        ? data.transactions.filter((t) => t.type === 'personal' && sameUserId(t.userId, hetId)).sort(sortByDateDesc)
        : [];

    const splitIncome = incomeAll.filter((t) => !isSoleFounderIncome(t));
    const sharedExpenses = data.transactions.filter((t) => t.type === 'expense').sort(sortByDateDesc);

    const ronitLabel = ronitId != null ? idToDisplay[String(ronitId)] || 'Ronit' : 'Ronit';
    const hetLabel = hetId != null ? idToDisplay[String(hetId)] || 'Het' : 'Het';

    return {
      incomeAll,
      ronitPersonal,
      hetPersonal,
      splitIncome,
      sharedExpenses,
      ronitLabel,
      hetLabel,
    };
  }, [data, idToDisplay]);

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050508' }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Loading lists…</p>
      </div>
    );
  }

  if (error || !data || !lists) {
    return (
      <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
        <p style={{ color: '#ff6b8a' }}>{error || 'No data.'}</p>
        <Link href="/dashboard" style={{ color: '#00ff41' }}>Back to dashboard</Link>
      </div>
    );
  }

  const renderTx = (t: Transaction) => {
    const userName =
      t.type === 'personal' && t.userId != null ? idToDisplay[String(t.userId)] : undefined;
    const incomeFromUserName =
      t.type === 'income' && t.incomeFromUserId != null ? idToDisplay[String(t.incomeFromUserId)] : undefined;
    return (
      <TransactionItem
        key={t.id}
        transaction={t}
        userName={userName}
        incomeFromUserName={incomeFromUserName}
        currentUserId={currentUserId}
        compact={false}
      />
    );
  };

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
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Separate view
            </p>
            <h1 style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 900, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={26} color="#00ff41" style={{ flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>Income & withdrawals</span>
            </h1>
          </div>
        </div>

        <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.5)' }}>
          Four lists from your saved data: every income row, each founder’s personal withdrawals, then what the app treats as <strong style={{ color: '#fff' }}>shared 50/50</strong> (split income and company expenses).{' '}
          <Link href="/transactions" style={{ color: '#7ec8ff', fontWeight: 700 }}>Edit on Transactions</Link>
        </p>

        <SectionShell
          title="All income"
          hint="Every transaction recorded as income (including entries credited to one founder only)."
          count={lists.incomeAll.length}
          totalLabel="Total income"
          totalAmount={sumAmount(lists.incomeAll)}
          accent="#00ff41"
        >
          {lists.incomeAll.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No income entries yet.</p>
          ) : (
            lists.incomeAll.map(renderTx)
          )}
        </SectionShell>

        <SectionShell
          title={`${lists.ronitLabel} — personal withdrawals`}
          hint="Personal transactions attributed to this founder (not split with the other)."
          count={lists.ronitPersonal.length}
          totalLabel="Total withdrawn"
          totalAmount={sumAmount(lists.ronitPersonal)}
          accent="#fff"
        >
          {lists.ronitPersonal.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No personal withdrawals for this profile.</p>
          ) : (
            lists.ronitPersonal.map(renderTx)
          )}
        </SectionShell>

        <SectionShell
          title={`${lists.hetLabel} — personal withdrawals`}
          hint="Personal transactions attributed to this founder (not split with the other)."
          count={lists.hetPersonal.length}
          totalLabel="Total withdrawn"
          totalAmount={sumAmount(lists.hetPersonal)}
          accent="#fff"
        >
          {lists.hetPersonal.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 0', fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No personal withdrawals for this profile.</p>
          ) : (
            lists.hetPersonal.map(renderTx)
          )}
        </SectionShell>

        <section
          style={{
            borderRadius: 20,
            border: '1px solid rgba(120,200,255,0.22)',
            background: 'rgba(120,200,255,0.05)',
            padding: '18px 18px 14px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Users size={22} color="#7ec8ff" />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>50 / 50 in the books</h2>
          </div>
          <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)' }}>
            Income that is <strong style={{ color: '#fff' }}>not</strong> tagged “one founder only” counts half toward each founder. Company <strong style={{ color: '#fff' }}>expenses</strong> are also split half each.
          </p>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#7ec8ff' }}>Split income (half each)</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#7ec8ff', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sumAmount(lists.splitIncome))}</p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{lists.splitIncome.length} entries</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lists.splitIncome.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No split income rows (all income may be “one founder only”, or there is no income yet).</p>
              ) : (
                lists.splitIncome.map(renderTx)
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0 18px' }} />

          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#ff6b8a' }}>Shared expenses (half each)</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ff6b8a', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sumAmount(lists.sharedExpenses))}</p>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{lists.sharedExpenses.length} entries</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lists.sharedExpenses.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No company expense entries yet.</p>
              ) : (
                lists.sharedExpenses.map(renderTx)
              )}
            </div>
          </div>
        </section>

        <Link
          href="/money-guide"
          style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 700, color: 'rgba(120,200,255,0.95)', textDecoration: 'none', borderBottom: '1px solid rgba(120,200,255,0.35)' }}
        >
          How these lists connect to balances →
        </Link>
      </div>
    </div>
  );
}
