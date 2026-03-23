'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, TransactionType } from '@/types';
import TransactionItem from '@/components/TransactionItem';
import { getSession } from '@/lib/auth';
import { BACKEND_URL } from '@/lib/backend';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';

type FilterValue = TransactionType | 'all' | 'mine' | 'shared';

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Mine', value: 'mine' },
  { label: 'Shared', value: 'shared' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
  { label: 'Personal', value: 'personal' },
];

const EDIT_CATEGORIES = {
  income: ['Client Payment', 'Invoice Payment', 'Project Revenue', 'Consulting', 'Other'],
  expense: ['Office Supplies', 'Software', 'Marketing', 'Travel', 'Utilities', 'Bank Fee', 'Other'],
  personal: ['Withdrawal', 'Salary Draw', 'Personal Expense', 'Other'],
} as const;

type SortValue = 'newest' | 'oldest' | 'amountAsc' | 'amountDesc';

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string }>>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortValue>('newest');

  const queryKeyRef = useRef<string>('');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [editType, setEditType] = useState<TransactionType>('income');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace('/login'); return; }
    const sessionBackendUserId = (session as any).backendUserId ?? null;
    const sessionFullName = session.fullName ?? null;
    const sessionUsername = (session as any).username ?? null;
    const sessionName = session.name ?? null;

    const loadUsers = async () => {
      setLoading(true);
      setPageError('');
      try {
        const usersRes = await fetch(`${BACKEND_URL}/api/users`);
        const usersData = (await usersRes.json()) as Array<{ id: string; fullName: string; username: string }>;
        const nextUsersMap: Record<string, string> = {};
        const nextUsersList = usersData.map((u) => ({
          id: u.id,
          name: (u.fullName || u.username).split(' ')[0] || (u.fullName || u.username),
        }));
        usersData.forEach((u) => {
          nextUsersMap[u.id] = u.fullName || u.username;
        });
        setUsersMap(nextUsersMap);
        setUsersList(nextUsersList);

        if (sessionBackendUserId) {
          setBackendUserId(sessionBackendUserId);
          return;
        }

        // If session doesn't have backendUserId, infer it from session display info.
        const norm = (s: string) => String(s).trim().toLowerCase();
        const match =
          (sessionFullName
            ? usersData.find((u) => norm(u.fullName) === norm(sessionFullName))
            : null) ??
          (sessionUsername
            ? usersData.find((u) => norm(u.username) === norm(sessionUsername))
            : null) ??
          (sessionName
            ? usersData.find(
              (u) => (u.fullName || u.username).split(' ')[0]?.toLowerCase() === norm(sessionName)
            )
            : null) ??
          null;

        if (match?.id) setBackendUserId(match.id);
      } catch {
        setPageError('Failed to load users.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    await fetch(`${BACKEND_URL}/api/transactions/${id}`, { method: 'DELETE' });
    // reload will happen via dependency effect
    setPage(1);
  };

  const loadTransactions = useCallback(async () => {
    if (filter === 'mine' && !backendUserId) {
      setTransactions([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('sort', sort);

      if (filter === 'mine') {
        params.set('mode', 'mine');
        params.set('mineUserId', backendUserId || '');
      } else if (filter === 'shared') {
        params.set('type', 'shared');
      } else if (filter === 'all') {
        params.set('type', 'all');
      } else {
        params.set('type', filter);
      }

      const q = search.trim();
      if (q) params.set('search', q);
      const c = category.trim();
      if (c) params.set('category', c);
      if (minAmount.trim()) params.set('minAmount', minAmount.trim());
      if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`${BACKEND_URL}/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load transactions');
      }

      setTransactions((json.items || []) as Transaction[]);
      setTotal(Number(json.total || 0));
    } catch (e: any) {
      setPageError(e?.message || 'Failed to load transactions.');
      setTransactions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    backendUserId,
    filter,
    page,
    limit,
    sort,
    search,
    category,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
  ]);

  // Reset page to 1 when filters (except page itself) change.
  const resetKey = useMemo(() => JSON.stringify({ filter, search, category, minAmount, maxAmount, dateFrom, dateTo, sort, limit }), [
    filter,
    search,
    category,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
    sort,
    limit,
  ]);

  useEffect(() => {
    if (!queryKeyRef.current) {
      queryKeyRef.current = resetKey;
      return;
    }
    if (queryKeyRef.current !== resetKey) {
      queryKeyRef.current = resetKey;
      setPage(1);
    }
  }, [resetKey]);

  useEffect(() => {
    // Wait until backendUserId resolved for mine-mode; still load for other filters.
    if (filter === 'mine' && !backendUserId) return;
    loadTransactions();
  }, [loadTransactions, backendUserId, filter, page]);

  const displayedTransactions = useMemo(() => {
    if (filter !== 'mine') return transactions;
    // Mine view: personal = full, shared = half
    return transactions.map((t) => {
      if (t.type === 'income' || t.type === 'expense') return { ...t, amount: t.amount / 2 };
      return t;
    });
  }, [transactions, filter]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const openEditById = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    setEditOpen(true);
    setEditingId(tx.id);
    setEditType(tx.type);
    setEditAmount(String(tx.amount));
    setEditCategory(tx.category);
    setEditDescription(tx.description || '');
    setEditUserId(tx.userId ? String(tx.userId) : '');
    setEditError('');
    setEditSaving(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const amountNum = parseFloat(editAmount);
    if (!editType || !editCategory || !Number.isFinite(amountNum) || amountNum <= 0) {
      setEditError('Enter a valid type/category/amount.');
      return;
    }
    if (editType === 'personal' && !editUserId) {
      setEditError('Pick the founder for personal transactions.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    try {
      const payload: Record<string, unknown> = {
        type: editType,
        amount: amountNum,
        category: editCategory,
        description: editDescription,
      };
      if (editType === 'personal') payload.userId = editUserId;

      const res = await fetch(`${BACKEND_URL}/api/transactions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to update transaction');
      }

      setEditOpen(false);
      setEditingId('');
      setEditSaving(false);
      setPage(1);
    } catch (e: any) {
      setEditError(e?.message || 'Failed to update transaction.');
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#000' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #00ff41', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const filterColor = (value: FilterValue, isActive: boolean) => {
    if (!isActive) return { color: 'rgba(255,255,255,0.35)', background: 'transparent', border: '1.5px solid rgba(255,255,255,0.1)' };
    if (value === 'income') return { color: '#000', background: '#00ff41', border: '1.5px solid #00ff41', boxShadow: '0 0 10px rgba(0,255,65,0.3)' };
    if (value === 'expense') return { color: '#fff', background: '#ff0033', border: '1.5px solid #ff0033', boxShadow: '0 0 10px rgba(255,0,51,0.3)' };
    if (value === 'mine' || value === 'shared') return { color: '#000', background: '#00ff41', border: '1.5px solid #00ff41', boxShadow: '0 0 10px rgba(0,255,65,0.3)' };
    return { color: '#000', background: '#ffffff', border: '1.5px solid #fff' };
  };

  return (
    <div className="md:px-8 md:py-7" style={{ padding: '20px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Transactions</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>{transactions.length} total</p>
        </div>
        <Link
          href="/add"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#00ff41',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
            boxShadow: '0 0 16px rgba(0,255,65,0.4)',
          }}
        >
          <Plus size={20} strokeWidth={3} color="#000" />
        </Link>
      </div>

      {pageError && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,0,51,0.2)', background: 'rgba(255,0,51,0.06)', color: '#ff0033', fontSize: 12, fontWeight: 600 }}>
          {pageError}
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map((f) => {
          const isActive = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                flexShrink: 0, padding: '7px 15px', borderRadius: 100,
                fontSize: 13, fontWeight: isActive ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                ...filterColor(f.value, isActive),
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Advanced filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description/category"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category contains…"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />

        <input
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Min amount"
          inputMode="decimal"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />
        <input
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Max amount"
          inputMode="decimal"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        >
          <option value="newest">Sort: newest</option>
          <option value="oldest">Sort: oldest</option>
          <option value="amountDesc">Sort: amount high</option>
          <option value="amountAsc">Sort: amount low</option>
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
        >
          <option value={10}>Page size: 10</option>
          <option value={20}>Page size: 20</option>
          <option value={50}>Page size: 50</option>
        </select>
      </div>

      {displayedTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'rgba(255,255,255,0.2)' }}>
          <p style={{ fontSize: 15, margin: 0 }}>No transactions</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayedTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              userName={tx.userId ? usersMap[String(tx.userId)] : undefined}
              onDelete={handleDelete}
              onEdit={(id) => openEditById(id)}
              currentUserId={backendUserId ?? undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.7)',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Prev
        </button>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
          Page {page} of {totalPages} · {total} total
        </div>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.7)',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          Next
        </button>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#0e0e10',
              borderRadius: 22,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Edit transaction</h2>
              <button
                onClick={() => setEditOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,0,51,0.25)', background: 'rgba(255,0,51,0.06)', color: '#ff0033', fontSize: 12, fontWeight: 700 }}>
                {editError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => {
                    const next = e.target.value as TransactionType;
                    setEditType(next);
                    if (next !== 'personal') setEditUserId('');
                    if (next === 'personal' && !editUserId && usersList[0]?.id) setEditUserId(usersList[0].id);
                    setEditCategory(EDIT_CATEGORIES[next][0]);
                  }}
                  style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Amount
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
                >
                  {(EDIT_CATEGORIES[editType] as unknown as string[]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
                />
              </div>

              {editType === 'personal' && (
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Founder
                  </label>
                  <select
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px', color: '#fff', outline: 'none' }}
                  >
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                onClick={() => setEditOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: '#00ff41',
                  border: 'none',
                  color: '#000',
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 900,
                }}
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
