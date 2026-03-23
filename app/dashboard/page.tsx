'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DBData, TransactionType } from '@/types';
import {
  calcFounderBalance,
  calcTotalRevenue,
  calcTotalExpenses,
  calcNetProfit,
  formatCurrency,
  formatCompact,
} from '@/lib/calculations';
import { getSession, clearSession, SessionUser } from '@/lib/auth';
import TransactionItem from '@/components/TransactionItem';
import Link from 'next/link';
import { BACKEND_URL } from '@/lib/backend';
import {
  ChevronRight, LogOut, ArrowDownLeft, ArrowUpRight,
  Wallet, TrendingUp, TrendingDown, Activity,
  BarChart2, PieChart, Eye, EyeOff, Sparkles,
  CalendarDays, Target,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────── */
function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { text: `Good morning, ${name}`, emoji: '☀️' };
  if (h >= 12 && h < 17) return { text: `Good afternoon, ${name}`, emoji: '🌤' };
  if (h >= 17 && h < 21) return { text: `Good evening, ${name}`, emoji: '🌆' };
  return { text: `Good night, ${name}`, emoji: '🌙' };
}

function getTopCategory(data: DBData): { name: string; amount: number } | null {
  const cats: Record<string, number> = {};
  data.transactions.filter((t) => t.type === 'expense').forEach((t) => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
}

function getMonthlyStats(data: DBData, anchor: Date) {
  const txs = data.transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
  });
  const income  = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, count: txs.length, net: income - expense };
}

function getLast6MonthsData(data: DBData, anchor: Date) {
  const months: { label: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth(); const y = d.getFullYear();
    const label = d.toLocaleString('default', { month: 'short' });
    const txs = data.transactions.filter((t) => {
      const td = new Date(t.date);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    months.push({
      label,
      income:  txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    });
  }
  return months;
}

function getCategoryBreakdown(data: DBData) {
  const cats: Record<string, number> = {};
  data.transactions.filter((t) => t.type === 'expense').forEach((t) => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });
  const total = Object.values(cats).reduce((s, v) => s + v, 0);
  const COLORS = ['#00ff41', '#ff0033', '#0099ff', '#ff9900', '#cc00ff', '#00ccff'];
  return Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount], i) => ({
      name, amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));
}

/* ─── SVG Bar Chart ────────────────────────── */
function BarChart({ months }: { months: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  const H = 120; const BAR_W = 14; const GAP = 6; const GROUP_GAP = 20;
  const totalW = months.length * (BAR_W * 2 + GAP + GROUP_GAP) - GROUP_GAP;

  return (
    <svg viewBox={`0 0 ${totalW} ${H + 24}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff41" stopOpacity="1" />
          <stop offset="100%" stopColor="#00cc34" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff3355" stopOpacity="1" />
          <stop offset="100%" stopColor="#cc0022" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {months.map((m, i) => {
        const x = i * (BAR_W * 2 + GAP + GROUP_GAP);
        const incH = (m.income / max) * H || 0;
        const expH = (m.expense / max) * H || 0;
        return (
          <g key={m.label}>
            {/* Income bar */}
            <rect
              x={x} y={H - incH} width={BAR_W} height={incH || 2}
              fill="url(#incomeGrad)" rx={4}
              style={{ transformOrigin: `${x + BAR_W / 2}px ${H}px`, animation: 'bar-grow 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
            />
            {/* Expense bar */}
            <rect
              x={x + BAR_W + GAP} y={H - expH} width={BAR_W} height={expH || 2}
              fill="url(#expenseGrad)" rx={4}
              style={{ transformOrigin: `${x + BAR_W * 1.5 + GAP}px ${H}px`, animation: 'bar-grow 0.6s 0.1s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
            />
            {/* Label */}
            <text
              x={x + BAR_W + GAP / 2} y={H + 17}
              textAnchor="middle" fill="rgba(255,255,255,0.3)"
              fontSize={9} fontFamily="inherit"
            >{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── SVG Line Chart ───────────────────────── */
function LineChart({ months }: { months: { label: string; income: number; expense: number }[] }) {
  const vals = months.map((m) => m.income - m.expense);
  const max = Math.max(...vals.map(Math.abs), 1);
  const W = 300; const H = 80; const PAD = 10;
  const plotW = W - PAD * 2; const plotH = H - PAD * 2;
  const pts = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * plotW;
    const y = PAD + plotH / 2 - (v / max) * (plotH / 2);
    return `${x},${y}`;
  });

  const pathD = pts.length > 1
    ? `M ${pts.join(' L ')}`
    : `M ${PAD},${PAD + plotH / 2} L ${W - PAD},${PAD + plotH / 2}`;

  const areaD = pts.length > 1
    ? `M ${pts[0].split(',')[0]},${PAD + plotH} L ${pts.join(' L ')} L ${pts[pts.length - 1].split(',')[0]},${PAD + plotH} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff41" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00ff41" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Zero line */}
      <line x1={PAD} y1={PAD + plotH / 2} x2={W - PAD} y2={PAD + plotH / 2}
        stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="3 3" />
      {/* Area fill */}
      {areaD && <path d={areaD} fill="url(#lineAreaGrad)" />}
      {/* Line */}
      <path d={pathD} fill="none" stroke="#00ff41" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        filter="url(#glow)"
        style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: 'line-draw 1.2s ease forwards 0.3s' }} />
      {/* Dots */}
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number);
        return (
          <circle key={i} cx={x} cy={y} r={3}
            fill={vals[i] >= 0 ? '#00ff41' : '#ff0033'}
            stroke="rgba(0,0,0,0.8)" strokeWidth={1.5} />
        );
      })}
    </svg>
  );
}

/* ─── SVG Donut Chart ──────────────────────── */
function DonutChart({ slices }: { slices: { name: string; pct: number; color: string; amount: number }[] }) {
  if (slices.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>No expense data</p>
      </div>
    );
  }

  const R = 40; const CX = 50; const CY = 50; const STROKE = 14;
  const circumference = 2 * Math.PI * R;
  let offset = 0;
  const arcs = slices.map((s) => {
    const dash = (s.pct / 100) * circumference;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
      <svg viewBox="0 0 100 100" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {/* background ring */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE} />
        {arcs.map((arc, i) => (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none"
            stroke={arc.color} strokeWidth={STROKE}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ filter: `drop-shadow(0 0 4px ${arc.color}60)` }}
          />
        ))}
      </svg>
      {/* Legend */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {arcs.slice(0, 4).map((arc) => (
          <div key={arc.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: arc.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flex: 1, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {arc.name}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>
              {arc.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Glassmorphism stat card ──────────────── */
function StatCard({
  label, value, sub, icon: Icon, color = 'rgba(255,255,255,0.08)',
  textColor = '#fff', delay = 0,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ElementType; color?: string; textColor?: string; delay?: number;
}) {
  return (
    <div
      className="stat-card"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        padding: '18px 20px',
        animation: `fadeUp 0.5s ease ${delay}s both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
            {label}
          </p>
          <p style={{
            fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5,
            color: textColor, fontVariantNumeric: 'tabular-nums',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {value}
          </p>
          {sub && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', margin: '5px 0 0', fontVariantNumeric: 'tabular-nums' }}>{sub}</p>}
        </div>
        {Icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={textColor} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [data,        setData]        = useState<DBData | null>(null);
  const [user,        setUser]        = useState<SessionUser | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [hidden,      setHidden]      = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Dashboard scope filters
  const [rangeMode, setRangeMode] = useState<'all' | 'thisMonth' | 'thisYear' | 'last6Months' | 'custom'>('all');
  const [customYear, setCustomYear] = useState<number | 'all'>('all');
  const [customMonth, setCustomMonth] = useState<number | 'all'>('all'); // 0-11
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [recentSort, setRecentSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace('/login'); return; }

    const load = async () => {
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

      // Stable mapping of backend ObjectIds -> numeric ids for existing calc* functions.
      const sorted = [...backendUsers].sort((a, b) =>
        (a.fullName || a.username).localeCompare(b.fullName || b.username)
      );
      const numericByBackendId: Record<string, number> = {};
      sorted.forEach((u, idx) => {
        numericByBackendId[u.id] = idx + 1;
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

      const mappedTx: DBData['transactions'] = backendTx.map((t) => {
        const mappedUserId =
          t.type === 'personal' && t.userId
            ? numericByBackendId[String(t.userId)]
            : undefined;

        return {
          id: t.id,
          type: t.type,
          category: t.category,
          amount: t.amount,
          description: t.description || '',
          userId: mappedUserId,
          date: new Date(t.date).toISOString(),
        };
      });

      const mappedSettlements: DBData['settlements'] = backendSettlements
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

      const sessionAny = session as any;
      const backendUserId = sessionAny.backendUserId as string | undefined;
      const sessionName = sessionAny.name as string | undefined;
      const sessionFullName = session.fullName as string | undefined;

      let currentUserId: number | null =
        backendUserId ? numericByBackendId[backendUserId] ?? null : null;

      if (!currentUserId) {
        const norm = (x: string) => String(x).trim().toLowerCase();
        const match =
          (sessionFullName
            ? sorted.find((u) => norm(u.fullName || u.username) === norm(sessionFullName))
            : null) ??
          (sessionName ? sorted.find((u) => norm(u.fullName.split(' ')[0]) === norm(sessionName)) : null) ??
          null;

        currentUserId = match ? numericByBackendId[match.id] : mappedUsers[0]?.id ?? null;
      }

      const currentUser = mappedUsers.find((u) => u.id === currentUserId) ?? mappedUsers[0];

      setUser({
        id: currentUser.id,
        name: currentUser.name,
        fullName: currentUser.fullName || currentUser.name,
        backendUserId: backendUserId,
        username: (sessionAny.username ?? null) || undefined,
      });
      setData({
        users: mappedUsers,
        transactions: mappedTx,
        invoices: [],
        settlements: mappedSettlements,
      });
      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [router]);

  const yearOptions = useMemo(() => {
    if (!data) return [];
    const years = Array.from(new Set(data.transactions.map((t) => new Date(t.date).getFullYear())));
    return years.sort((a, b) => b - a);
  }, [data]);

  const anchorDate = useMemo(() => {
    const now = new Date();
    if (rangeMode === 'thisMonth' || rangeMode === 'last6Months' || rangeMode === 'all') return now;
    if (rangeMode === 'thisYear') return new Date(now.getFullYear(), 11, 1);
    if (rangeMode === 'custom') {
      if (typeof customYear === 'number' && typeof customMonth === 'number') return new Date(customYear, customMonth, 1);
      if (typeof customYear === 'number') return new Date(customYear, 11, 1);
      if (typeof customMonth === 'number') return new Date(now.getFullYear(), customMonth, 1);
    }
    return now;
  }, [rangeMode, customYear, customMonth]);

  const rangeLabel = useMemo(() => {
    if (rangeMode === 'all') return 'All time';
    if (rangeMode === 'thisMonth') return 'This month';
    if (rangeMode === 'thisYear') return 'This year';
    if (rangeMode === 'last6Months') return 'Last 6 months';
    // custom
    if (typeof customYear === 'number' && typeof customMonth === 'number') {
      const m = new Date(customYear, customMonth, 1).toLocaleString('default', { month: 'short' });
      return `${m} ${customYear}`;
    }
    if (typeof customYear === 'number') return `${customYear}`;
    return 'Custom';
  }, [rangeMode, customYear, customMonth]);

  /* ─ derived data ──────────────────────────── */
  const derived = useMemo(() => {
    if (!data || !user) return null;

    const now = new Date();
    const inScope = (iso: string) => {
      const d = new Date(iso);
      if (rangeMode === 'all') return true;
      if (rangeMode === 'thisMonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (rangeMode === 'thisYear') return d.getFullYear() === now.getFullYear();
      if (rangeMode === 'last6Months') {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 5);
        return d >= start && d <= now;
      }
      if (rangeMode === 'custom') {
        if (typeof customYear === 'number' && d.getFullYear() !== customYear) return false;
        if (typeof customMonth === 'number' && d.getMonth() !== customMonth) return false;
        return true;
      }
      return true;
    };

    const scopedTransactions = data.transactions
      .filter((t) => inScope(t.date))
      .filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter));

    const scopedSettlements = data.settlements.filter((s) => inScope(s.date));

    const scopeData: DBData = {
      ...data,
      transactions: scopedTransactions,
      settlements: scopedSettlements,
    };

    const isRonit     = (user.fullName || '').toLowerCase().includes('ronit');
    const myBal       = calcFounderBalance(user.id, scopeData);
    const partnerUser = scopeData.users.find((u) => u.id !== user.id) ?? scopeData.users[0];
    const partnerBal  = partnerUser ? calcFounderBalance(partnerUser.id, scopeData) : myBal;
    const revenue     = calcTotalRevenue(scopeData);
    const expenses    = calcTotalExpenses(scopeData);
    const netProfit   = calcNetProfit(scopeData);

    const recentSorted = [...scopeData.transactions].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      return recentSort === 'newest' ? tb - ta : ta - tb;
    });
    const recent      = recentSorted.slice(0, 6);

    const topCat      = getTopCategory(scopeData);
    const monthStats  = getMonthlyStats(scopeData, anchorDate);
    const months6     = getLast6MonthsData(scopeData, anchorDate);
    const catBreakdown = getCategoryBreakdown(scopeData);

    const userMap: Record<string, string> = {};
    scopeData.users.forEach((u) => (userMap[String(u.id)] = u.name));

    const greeting    = getGreeting(user.name || user.fullName || 'Founder');
    const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : '0.0';
    const avgTxSize   = scopeData.transactions.length > 0
      ? scopeData.transactions.reduce((s, t) => s + t.amount, 0) / scopeData.transactions.length
      : 0;
    const totalTx     = scopeData.transactions.length;
    return {
      isRonit, myBal, partnerUser, partnerBal, revenue, expenses, netProfit, recent,
      topCat, monthStats, months6, catBreakdown, userMap, greeting, profitMargin,
      avgTxSize, totalTx,
    };
  }, [data, user, rangeMode, customYear, customMonth, typeFilter, recentSort, anchorDate]);

  if (loading || !data || !user || !derived) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#000' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(0,255,65,0.3)', borderTopColor: '#00ff41', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>Loading dashboard…</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const mask = (val: string) => hidden ? '••••••' : val;
  const accentColor = derived.isRonit ? '#00ff41' : '#ffffff';
  const displayName = user.fullName || user.name || 'User';
  const initial = (user.name || user.fullName || 'U')[0]?.toUpperCase() || 'U';

  const handleLogout = () => { clearSession(); router.replace('/login'); };

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg,#000 0%,#060808 50%,#000 100%)' }}>

      {/* ═══ DESKTOP LAYOUT ═══════════════════════════════ */}
      <div className="hidden md:block" style={{ padding: '28px 32px' }}>

        {/* ── Top bar ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{derived.greeting.emoji}</span> {derived.greeting.text.split(',')[0] + ','}
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
              {user.fullName}
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: derived.isRonit ? 'rgba(0,255,65,0.12)' : 'rgba(255,255,255,0.08)', color: derived.isRonit ? '#00ff41' : 'rgba(255,255,255,0.6)', border: `1px solid ${derived.isRonit ? 'rgba(0,255,65,0.25)' : 'rgba(255,255,255,0.12)'}` }}>
                Founder
              </span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Hide toggle */}
            <button
              onClick={() => setHidden(!hidden)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600,
              }}
            >
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {hidden ? 'Show' : 'Hide'} balances
            </button>
            {/* Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: derived.isRonit ? 'linear-gradient(135deg,#00ff41,#00cc34)' : 'linear-gradient(135deg,#fff,#ccc)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 800, color: '#000',
              }}
            >
              {initial}
            </button>
          </div>
        </div>

        {/* ── Scope filters ───────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 18,
            padding: '10px 12px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Range
            </span>
            <select
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value as any)}
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none' }}
            >
              <option value="all">All time</option>
              <option value="thisMonth">This month</option>
              <option value="thisYear">This year</option>
              <option value="last6Months">Last 6 months</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {rangeMode === 'custom' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Year
                </span>
                <select
                  value={customYear}
                  onChange={(e) => setCustomYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none' }}
                >
                  <option value="all">All</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Month
                </span>
                <select
                  value={customMonth}
                  onChange={(e) => setCustomMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none' }}
                >
                  <option value="all">All</option>
                  {Array.from({ length: 12 }).map((_, m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m, 1).toLocaleString('default', { month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Type
            </span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none' }}
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recent
            </span>
            <select
              value={recentSort}
              onChange={(e) => setRecentSort(e.target.value as any)}
              style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none' }}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <button
            onClick={() => {
              setRangeMode('all');
              setCustomYear('all');
              setCustomMonth('all');
              setTypeFilter('all');
              setRecentSort('newest');
            }}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              padding: '8px 12px',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        </div>

        {/* ── Balance hero + quick stats row ───────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* My Balance — wide hero */}
          <div
            style={{
              gridColumn: 'span 2',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 24,
              padding: '24px 28px',
              animation: 'fadeUp 0.4s ease both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>My Balance</span>
            </div>
            <p style={{
              fontSize: 44, fontWeight: 900, margin: '4px 0 16px', letterSpacing: -1.5,
              color: derived.myBal.balance >= 0 ? accentColor : '#ff0033',
            textShadow: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {mask(formatCurrency(derived.myBal.balance))}
            </p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{derived.partnerUser.name}&apos;s Balance</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums', color: derived.partnerBal.balance >= 0 ? 'rgba(255,255,255,0.7)' : '#ff0033' }}>
                  {mask(formatCurrency(derived.partnerBal.balance))}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company Total</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {mask(formatCurrency(derived.myBal.balance + derived.partnerBal.balance))}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <StatCard
            label="Total Revenue" value={mask(formatCompact(derived.revenue))}
            sub={rangeLabel} icon={TrendingUp}
            color="rgba(255,255,255,0.06)" textColor="#00ff41"
            delay={0.05}
          />
          {/* Expenses */}
          <StatCard
            label="Total Expenses" value={mask(formatCompact(derived.expenses))}
            sub={rangeLabel} icon={TrendingDown}
            color="rgba(255,255,255,0.06)" textColor="#ff0033"
            delay={0.1}
          />
        </div>

        {/* ── Secondary stats row ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard
            label="Net Profit" value={mask(formatCompact(derived.netProfit))}
            sub="Revenue − Expenses" icon={Activity}
            color="rgba(255,255,255,0.06)"
            textColor={derived.netProfit >= 0 ? '#00ff41' : '#ff0033'}
            delay={0.15}
          />
          <StatCard
            label="Profit Margin" value={`${derived.profitMargin}%`}
            sub="Net / Revenue" icon={Target}
            color="rgba(255,255,255,0.06)" textColor="rgba(255,255,255,0.85)"
            delay={0.2}
          />
          <StatCard
            label="This Month Income" value={mask(formatCompact(derived.monthStats.income))}
            sub={`${derived.monthStats.count} transactions`} icon={CalendarDays}
            color="rgba(255,255,255,0.06)" textColor="#00ff41"
            delay={0.25}
          />
          <StatCard
            label="My Share Withdrawn" value={mask(formatCompact(derived.myBal.totalPersonalWithdrawals))}
            sub="Personal withdrawals" icon={Wallet}
            color="rgba(255,255,255,0.06)" textColor="rgba(255,255,255,0.85)"
            delay={0.3}
          />
        </div>

        {/* ── Charts row ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Bar chart — 6 months */}
          <div style={{
            gridColumn: 'span 2',
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px',
            animation: 'fadeUp 0.5s 0.2s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={16} color="#00ff41" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Revenue vs Expenses</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00ff41', display: 'inline-block' }} />
                  Income
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ff3355', display: 'inline-block' }} />
                  Expenses
                </span>
              </div>
            </div>
            <div style={{ height: 148 }}>
              {derived.months6.some(m => m.income > 0 || m.expense > 0) ? (
                <BarChart months={derived.months6} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                  <BarChart2 size={28} color="rgba(255,255,255,0.1)" />
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>Add transactions to see chart</p>
                </div>
              )}
            </div>
          </div>

          {/* Donut chart — category breakdown */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px',
            animation: 'fadeUp 0.5s 0.3s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <PieChart size={16} color="#ff9900" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Expense Breakdown</span>
            </div>
            <div style={{ height: 130 }}>
              <DonutChart slices={derived.catBreakdown} />
            </div>
          </div>
        </div>

        {/* ── Net trend + recent transactions ─────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>

          {/* Net trend line chart */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px',
            animation: 'fadeUp 0.5s 0.35s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Sparkles size={15} color="#00ff41" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Net Profit Trend</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '0 0 14px' }}>Last 6 months</p>
            <div style={{ height: 90 }}>
              <LineChart months={derived.months6} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Transaction</p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCompact(derived.avgTxSize)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Txns</p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{derived.totalTx}</p>
              </div>
            </div>
          </div>

          {/* Recent transactions */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '20px 22px',
            animation: 'fadeUp 0.5s 0.4s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Transactions</span>
              <Link href="/transactions" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
                See all <ChevronRight size={12} />
              </Link>
            </div>
            {derived.recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: '0 0 14px' }}>No transactions yet</p>
                <Link href="/add" style={{ display: 'inline-block', padding: '10px 20px', background: '#00ff41', color: '#000', borderRadius: 100, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  Add first
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {derived.recent.map((tx) => (
                  <TransactionItem
                    key={tx.id} transaction={tx}
                    userName={tx.userId !== undefined ? derived.userMap[String(tx.userId)] : undefined}
                    compact currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MOBILE LAYOUT ═══════════════════════════════ */}
      <div className="md:hidden">
        {/* Header */}
        <div style={{ padding: '20px 20px 16px' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
            {derived.greeting.emoji} {derived.greeting.text.split(',')[0] + ','}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{displayName}</h1>
            <button
              onClick={() => setShowProfile(true)}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: derived.isRonit ? '#00ff41' : '#ffffff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: '#000',
              }}
            >
              {initial}
            </button>
          </div>
        </div>

        {/* Mobile scope filters */}
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Range
              </span>
              <select
                value={rangeMode}
                onChange={(e) => setRangeMode(e.target.value as any)}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none', maxWidth: 150 }}
              >
                <option value="all">All</option>
                <option value="thisMonth">Month</option>
                <option value="thisYear">Year</option>
                <option value="last6Months">6 Mo</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Type
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none', maxWidth: 150 }}
              >
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Recent
              </span>
              <select
                value={recentSort}
                onChange={(e) => setRecentSort(e.target.value as any)}
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 10px', color: '#fff', outline: 'none', maxWidth: 150 }}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>

            <button
              onClick={() => {
                setRangeMode('all');
                setCustomYear('all');
                setCustomMonth('all');
                setTypeFilter('all');
                setRecentSort('newest');
              }}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                padding: '8px 10px',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                height: 36,
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Mobile balance card */}
        <div style={{ margin: '0 16px 16px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My Balance</p>
              <p style={{
                fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: -1,
                color: derived.myBal.balance >= 0 ? accentColor : '#ff0033',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {mask(formatCurrency(derived.myBal.balance))}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{derived.partnerUser.name}&apos;s balance</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: derived.partnerBal.balance >= 0 ? 'rgba(255,255,255,0.6)' : '#ff0033' }}>
                {mask(formatCurrency(derived.partnerBal.balance))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px 6px' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Company total</span>
              <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {mask(formatCurrency(derived.myBal.balance + derived.partnerBal.balance))}
              </span>
            </div>
            <button
              onClick={() => setHidden(!hidden)}
              style={{ width: '100%', padding: '11px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              {hidden ? <Eye size={12} /> : <EyeOff size={12} />} {hidden ? 'Show balances' : 'Hide balances'}
            </button>
          </div>
        </div>

        {/* Mobile quick stats */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'My Share', val: formatCompact(derived.myBal.totalIncome / 2), color: '#00ff41', icon: ArrowDownLeft },
              { label: 'Withdrawn', val: formatCompact(derived.myBal.totalPersonalWithdrawals), color: '#ff0033', icon: Wallet },
              { label: 'Net', val: formatCompact(derived.netProfit), color: derived.netProfit >= 0 ? '#00ff41' : '#ff0033', icon: ArrowUpRight },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', padding: '14px 12px' }}>
                <Icon size={15} color={color} style={{ marginBottom: 7 }} />
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Revenue', val: formatCompact(derived.revenue), color: '#00ff41' },
              { label: 'Total Expenses', val: formatCompact(derived.expenses), color: '#ff0033' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', padding: '16px', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color, textShadow: `0 0 14px ${color}60`, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Mobile bar chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <BarChart2 size={14} color="#00ff41" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Revenue vs Expenses</span>
            </div>
            <div style={{ height: 120 }}>
              {derived.months6.some(m => m.income > 0 || m.expense > 0) ? (
                <BarChart months={derived.months6} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>Add transactions to see chart</p>
                </div>
              )}
            </div>
          </div>

          {/* Insight pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {derived.topCat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,0,51,0.06)', border: '1px solid rgba(255,0,51,0.2)', borderRadius: 100, padding: '5px 12px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ff0033', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top spend</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{derived.topCat.name}</span>
              </div>
            )}
            {derived.monthStats.count > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,255,65,0.05)', border: '1px solid rgba(0,255,65,0.15)', borderRadius: 100, padding: '5px 12px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#00ff41', textTransform: 'uppercase', letterSpacing: '0.06em' }}>This month</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{derived.monthStats.count} txns</span>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>Recent</p>
            <Link href="/transactions" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
              See all <ChevronRight size={13} />
            </Link>
          </div>
          {derived.recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', margin: '0 0 12px' }}>No transactions yet</p>
              <Link href="/add" style={{ display: 'inline-block', padding: '10px 20px', background: '#00ff41', color: '#000', borderRadius: 100, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Add first transaction
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {derived.recent.map((tx) => (
                <TransactionItem
                  key={tx.id} transaction={tx}
                  userName={tx.userId !== undefined ? derived.userMap[String(tx.userId)] : undefined}
                  compact currentUserId={user.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ PROFILE SHEET (shared) ═══════════════════════ */}
      {showProfile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
          onClick={() => setShowProfile(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: 520,
              background: 'rgba(14,14,16,0.97)',
              backdropFilter: 'blur(32px)',
              borderRadius: '28px 28px 0 0',
              border: '1px solid rgba(255,255,255,0.09)',
              padding: '12px 24px 52px',
              animation: 'fadeUp 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 22px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: derived.isRonit ? 'linear-gradient(135deg,#00ff41,#00cc34)' : 'linear-gradient(135deg,#fff,#ccc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 800, color: '#000',
                boxShadow: derived.isRonit ? '0 0 20px rgba(0,255,65,0.4)' : '0 0 12px rgba(255,255,255,0.25)',
              }}>
                {initial}
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 3px' }}>{displayName}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Founder · 50% share</p>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 18, padding: 16, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'My Balance',     val: formatCurrency(derived.myBal.balance),                       color: derived.myBal.balance >= 0 ? '#00ff41' : '#ff0033' },
                { label: 'Income Share',   val: formatCurrency(derived.myBal.totalIncome / 2),               color: '#00ff41'  },
                { label: 'Expense Share',  val: formatCurrency(derived.myBal.totalSharedExpenses / 2),       color: '#ff0033'  },
                { label: 'Withdrawals',    val: formatCurrency(derived.myBal.totalPersonalWithdrawals),       color: 'rgba(255,255,255,0.5)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '15px', borderRadius: 16,
                border: '1px solid rgba(255,0,51,0.25)',
                background: 'rgba(255,0,51,0.07)', color: '#ff0033',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <LogOut size={17} /> Switch Account / Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
