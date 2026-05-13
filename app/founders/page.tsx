'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DBData, FounderBalance } from '@/types';
import {
  calcFounderBalance,
  calcSettlementSuggestion,
  formatCurrency,
} from '@/lib/calculations';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { BACKEND_URL } from '@/lib/backend';

export default function FoundersPage() {
  const router = useRouter();
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [note, setNote] = useState('');
  const [backendIdByNumeric, setBackendIdByNumeric] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const [usersRes, txRes, settlementsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/users`),
      fetch(`${BACKEND_URL}/api/transactions`),
      fetch(`${BACKEND_URL}/api/settlements`),
    ]);

    const backendUsers = (await usersRes.json()) as Array<{
      id: string;
      username: string;
      fullName: string;
    }>;
    const backendTx = (await txRes.json()) as Array<{
      id: string;
      type: 'income' | 'expense' | 'personal';
      category: string;
      amount: number;
      description: string;
      userId?: string;
      incomeFromUserId?: string;
      date: string;
    }>;
    const backendSettlements = (await settlementsRes.json()) as Array<{
      id: string;
      fromUserId: string;
      toUserId: string;
      amount: number;
      note?: string;
      date: string;
    }>;

    // Map backend ObjectIds -> numeric ids so existing calc* functions keep working.
    const sorted = [...backendUsers].sort((a, b) =>
      (a.fullName || a.username).localeCompare(b.fullName || b.username)
    );
    const numericByBackendId: Record<string, number> = {};
    const backendByNumeric: Record<number, string> = {};
    sorted.forEach((u, idx) => {
      const numericId = idx + 1;
      numericByBackendId[u.id] = numericId;
      backendByNumeric[numericId] = u.id;
    });

    const mappedUsers = sorted.map((u) => {
      const displayName = (u.fullName || u.username).trim();
      const firstName = displayName.split(' ')[0] || displayName;
      return {
        id: numericByBackendId[u.id],
        name: firstName,
        fullName: u.fullName || u.username,
      };
    });

    const mappedTx = backendTx.map((t) => {
      const maybeUserId = t.type === 'personal' && t.userId ? numericByBackendId[String(t.userId)] : undefined;
      const maybeIncomeFrom =
        t.type === 'income' && t.incomeFromUserId ? numericByBackendId[String(t.incomeFromUserId)] : undefined;
      return {
        id: t.id,
        type: t.type,
        category: t.category,
        amount: t.amount,
        description: t.description || '',
        userId: maybeUserId,
        incomeFromUserId: maybeIncomeFrom,
        date: new Date(t.date).toISOString(),
      };
    });

    const mappedSettlements = backendSettlements
      .map((s) => {
        const fromN = numericByBackendId[String(s.fromUserId)];
        const toN = numericByBackendId[String(s.toUserId)];
        if (fromN === undefined || toN === undefined) return null;
        return {
          id: s.id,
          fromUserId: fromN,
          toUserId: toN,
          amount: s.amount,
          note: s.note || '',
          date: new Date(s.date).toISOString(),
        };
      })
      .filter(Boolean) as DBData['settlements'];

    setBackendIdByNumeric(backendByNumeric);
    setData({
      users: mappedUsers,
      transactions: mappedTx,
      invoices: [],
      settlements: mappedSettlements,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    load();
  }, [load, router]);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #00ff41', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const balances = data.users.map((u) => calcFounderBalance(u.id, data));
  const suggestion = calcSettlementSuggestion(balances);

  const handleSettle = async () => {
    if (!suggestion) return;
    setSettling(true);
    try {
      const fromBackendId = backendIdByNumeric[suggestion.fromUserId];
      const toBackendId = backendIdByNumeric[suggestion.toUserId];
      if (!fromBackendId || !toBackendId) {
        setSettling(false);
        return;
      }

      await fetch(`${BACKEND_URL}/api/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: fromBackendId,
          toUserId: toBackendId,
          amount: suggestion.amount,
          note: note || `Settlement: ${suggestion.fromName} → ${suggestion.toName}`,
        }),
      });

      setNote('');
    } finally {
      setSettling(false);
      load();
    }
  };

  const allWith = data.transactions
    .filter((t) => t.type === 'personal' && typeof t.userId === 'number')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const founderCard = (
    name: string, initial: string, bal: FounderBalance,
    accentColor: string
  ) => (
    <div
      style={{
        background: '#111', borderRadius: 20,
        border: `1px solid ${bal.balance >= 0 ? 'rgba(0,255,65,0.12)' : 'rgba(255,0,51,0.12)'}`,
        padding: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: accentColor === '#fff' ? '#000' : '#000',
            boxShadow: `0 0 12px ${accentColor}60`,
          }}
        >{initial}</div>
        <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{name}</p>
      </div>
      <p
        style={{
          fontSize: 32, fontWeight: 800, margin: '0 0 14px',
          color: bal.balance >= 0 ? '#00ff41' : '#ff0033',
          textShadow: bal.balance >= 0 ? '0 0 14px rgba(0,255,65,0.4)' : '0 0 14px rgba(255,0,51,0.4)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: -1,
        }}
      >
        {formatCurrency(bal.balance)}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'Income credited', val: `+${formatCurrency(bal.incomeCredited)}`, c: '#00ff41' },
          { label: 'Expense share', val: `-${formatCurrency(bal.totalSharedExpenses / 2)}`, c: '#ff0033' },
          { label: 'Withdrawals', val: `-${formatCurrency(bal.totalPersonalWithdrawals)}`, c: 'rgba(255,255,255,0.5)' },
        ].map(({ label, val, c }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="md:px-8 md:py-7" style={{ padding: '20px 16px 0' }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 4px', letterSpacing: -0.5 }}>Founders</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 24px' }}>Balance & settlement</p>

      {/* Founder cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {balances.map((b, idx) => {
          const accentColor = b.balance >= 0 ? '#00ff41' : '#ff0033';
          const initial = (b.name?.[0] || '?').toUpperCase();
          return founderCard(b.name, initial, b, idx % 2 === 0 ? accentColor : '#ffffff');
        })}
      </div>

      {/* Settlement */}
      {suggestion ? (
        <div
          style={{
            background: '#111', borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 18px', marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            Settlement needed
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{suggestion.fromName}</span>
            <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>{suggestion.toName}</span>
            <span
              style={{
                marginLeft: 'auto', fontSize: 20, fontWeight: 800,
                color: '#00ff41', textShadow: '0 0 12px rgba(0,255,65,0.5)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >{formatCurrency(suggestion.amount)}</span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '0 0 14px', lineHeight: 1.5 }}>
            {suggestion.fromName} should pay {formatCurrency(suggestion.amount)} to {suggestion.toName} to equalize.
          </p>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            style={{
              width: '100%', background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
              padding: '12px 14px', fontSize: 14, color: '#fff',
              fontFamily: 'inherit', marginBottom: 12,
            }}
          />
          <button
            onClick={handleSettle}
            disabled={settling}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: '#00ff41', color: '#000',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,255,65,0.3)',
            }}
          >
            {settling ? 'Recording…' : 'Record Settlement'}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(0,255,65,0.06)', borderRadius: 16,
            border: '1px solid rgba(0,255,65,0.15)',
            padding: '14px 16px', marginBottom: 24,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 8px #00ff41', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#00ff41', margin: '0 0 2px' }}>Balances are equal</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>No settlement needed right now.</p>
          </div>
        </div>
      )}

      {/* Withdrawals table */}
      {allWith.length > 0 && (
        <>
          <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: 'rgba(255,255,255,0.7)' }}>Withdrawals</p>
          <div style={{ background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 24 }}>
            {allWith.map((tx, i) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderBottom: i < allWith.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 2px' }}>
                    {data.users.find((u) => u.id === tx.userId)?.name ?? 'Unknown'}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
                    {tx.description || tx.category} · {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ff0033', fontVariantNumeric: 'tabular-nums' }}>
                  -{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Settlement history */}
      {data.settlements.length > 0 && (
        <>
          <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 12px', color: 'rgba(255,255,255,0.7)' }}>History</p>
          <div style={{ background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {data.settlements.map((s, i) => {
              const from = data.users.find((u) => u.id === s.fromUserId)?.name ?? '?';
              const to = data.users.find((u) => u.id === s.toUserId)?.name ?? '?';
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 16px',
                    borderBottom: i < data.settlements.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{from}</span>
                    <ArrowRight size={12} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{to}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#00ff41', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(s.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
