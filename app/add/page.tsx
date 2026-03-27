'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionType } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import { getSession } from '@/lib/auth';
import { BACKEND_URL } from '@/lib/backend';
import { ChevronLeft } from 'lucide-react';

const categories = {
  income: ['Client Payment', 'Invoice Payment', 'Project Revenue', 'Consulting', 'Other'],
  expense: ['Office Supplies', 'Software', 'Marketing', 'Travel', 'Utilities', 'Bank Fee', 'Food', 'Other'],
  personal: ['Withdrawal', 'Salary Draw', 'Personal Expense', 'Other'],
};

const TYPE_CONFIG = {
  income: { label: 'Income', color: '#00ff41', bg: 'rgba(0,255,65,0.1)', border: 'rgba(0,255,65,0.3)' },
  expense: { label: 'Expense', color: '#ff0033', bg: 'rgba(255,0,51,0.1)', border: 'rgba(255,0,51,0.3)' },
  personal: { label: 'Personal', color: '#ffffff', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.2)' },
};

/** Selected calendar day + current local time so multiple txs on the same day sort by when they were added. */
function toTransactionIsoDate(calendarYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calendarYmd.trim());
  if (!m) return new Date().toISOString();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const now = new Date();
  return new Date(
    y,
    mo - 1,
    da,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ).toISOString();
}

export default function AddTransactionPage() {
  const router = useRouter();
  const [type, setType] = useState<TransactionType>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories.income[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [userId, setUserId] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsersAndSession = async () => {
      const session = getSession();
      if (!session) { router.replace('/login'); return; }

      setSessionName(session.name);

      const usersRes = await fetch(`${BACKEND_URL}/api/users`);
      const usersData = (await usersRes.json()) as Array<{ id: string; fullName: string; username: string }>;

      const mapped = usersData.map((u) => ({
        id: u.id,
        name: (u.fullName || u.username).split(' ')[0] || (u.fullName || u.username),
      }));
      setUsers(mapped);

      const sessionBackendUserId = (session as any).backendUserId ?? '';
      const norm = (s: string) => String(s).trim().toLowerCase();
      const sessionFullName = session.fullName ?? '';
      const sessionUsername = (session as any).username ?? '';
      const sessionNameDisplay = session.name ?? '';

      let resolvedBackendUserId = sessionBackendUserId;
      if (!resolvedBackendUserId) {
        resolvedBackendUserId =
          (sessionFullName
            ? usersData.find((u) => norm(u.fullName) === norm(sessionFullName))?.id
            : null) ??
          (sessionUsername
            ? usersData.find((u) => norm(u.username) === norm(sessionUsername))?.id
            : null) ??
          (sessionNameDisplay
            ? usersData.find((u) => (u.fullName || u.username).split(' ')[0]?.toLowerCase() === norm(sessionNameDisplay))?.id
            : null) ??
          (mapped[0]?.id ?? '');
      }

      setSessionUserId(resolvedBackendUserId);
      setUserId(resolvedBackendUserId);
    };
    loadUsersAndSession();
  }, [router]);

  useEffect(() => { setCategory(categories[type][0]); }, [type]);

  const amountNum = parseFloat(amount) || 0;
  const cfg = TYPE_CONFIG[type];

  const preview = (() => {
    if (amountNum <= 0) return null;
    const founders = users.map((u) => u.name);
    const a = founders[0] || 'Founder A';
    const b = founders[1] || 'Founder B';
    const name = users.find((u) => u.id === userId)?.name || 'selected founder';
    if (type === 'income') return `Splits equally — ${a} ${formatCurrency(amountNum / 2)} + ${b} ${formatCurrency(amountNum / 2)}`;
    if (type === 'expense') return `Deducts ${formatCurrency(amountNum / 2)} from each founder`;
    return `Deducts ${formatCurrency(amountNum)} from ${name} only`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0) return;
    setSubmitting(true);
    setError('');
    const payload: Record<string, unknown> = {
      type,
      amount: amountNum,
      category,
      description,
      date: toTransactionIsoDate(date),
    };
    if (type === 'personal') payload.userId = userId;
    const res = await fetch(`${BACKEND_URL}/api/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || 'Failed to save transaction');
      setSubmitting(false);
      return;
    }

    router.push('/transactions');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 16px', fontSize: 16, color: '#fff', fontFamily: 'inherit',
  };

  return (
    <div className="md:px-8 md:py-7" style={{ padding: '20px 0 0' }}>
      {/* Header */}
      <div style={{ padding: '0 16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Add Transaction</h1>
          {sessionName && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Logged in as {sessionName}</p>}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Type selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
          {(Object.keys(TYPE_CONFIG) as TransactionType[]).map((t) => {
            const c = TYPE_CONFIG[t];
            const isActive = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '12px 8px', borderRadius: 16,
                  border: `1.5px solid ${isActive ? c.border : 'rgba(255,255,255,0.07)'}`,
                  background: isActive ? c.bg : '#111',
                  color: isActive ? c.color : 'rgba(255,255,255,0.35)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Big amount input */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Amount</p>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ fontSize: 28, fontWeight: 300, color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>₹</span>
              <input
                type="number" min="1" step="any" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0" required
                style={{
                  background: 'transparent', border: 'none', padding: 0,
                  fontSize: 52, fontWeight: 800, color: amountNum > 0 ? cfg.color : 'rgba(255,255,255,0.2)',
                  width: 185, letterSpacing: -2,
                  textShadow: amountNum > 0 ? `0 0 24px ${cfg.color}60` : 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Category</p>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {categories[type].map((c) => <option key={c} value={c} style={{ background: '#111' }}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Note (optional)</p>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this for?" style={inputStyle} />
          </div>

          {/* Date (expense + others) */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Date
            </p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {/* Founder — personal only */}
          {type === 'personal' && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Founder</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUserId(u.id)}
                    style={{
                      padding: '13px', borderRadius: 14,
                      border: `1.5px solid ${userId === u.id ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      background: userId === u.id ? 'rgba(255,255,255,0.07)' : '#111',
                      color: userId === u.id ? '#fff' : 'rgba(255,255,255,0.35)',
                      fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {u.name}{u.id === sessionUserId ? ' (me)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div style={{ padding: '12px 14px', marginBottom: 18, borderRadius: 14, border: `1px solid ${cfg.border}`, background: cfg.bg }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: `${cfg.color}88`, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Split Preview</p>
              <p style={{ fontSize: 13, color: cfg.color, margin: 0 }}>{preview}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={submitting || amountNum <= 0}
            style={{
              width: '100%', padding: '16px', borderRadius: 16, border: 'none',
              background: amountNum > 0 && !submitting ? cfg.color : '#1a1a1a',
              color: amountNum > 0 && !submitting ? (type === 'expense' ? '#fff' : '#000') : 'rgba(255,255,255,0.2)',
              fontSize: 16, fontWeight: 700, cursor: amountNum > 0 ? 'pointer' : 'not-allowed',
              boxShadow: amountNum > 0 && !submitting ? `0 0 24px ${cfg.color}40` : 'none',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Saving…' : 'Save Transaction'}
          </button>
        </form>
      </div>
    </div>
  );
}
