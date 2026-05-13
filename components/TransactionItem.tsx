import { Transaction } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import { Pencil, Trash2 } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
  userName?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  compact?: boolean;
  currentUserId?: number | string; // logged-in user — shows "YOURS" badge
}

const typeConfig = {
  income: {
    label: 'INCOME',
    badgeStyle: { color: '#00ff41', border: '1px solid rgba(0,255,65,0.35)', background: 'rgba(0,255,65,0.07)' },
    amountStyle: { color: '#00ff41', textShadow: '0 0 8px rgba(0,255,65,0.4)' },
    prefix: '+',
  },
  expense: {
    label: 'EXPENSE',
    badgeStyle: { color: '#ff0033', border: '1px solid rgba(255,0,51,0.35)', background: 'rgba(255,0,51,0.07)' },
    amountStyle: { color: '#ff0033', textShadow: '0 0 8px rgba(255,0,51,0.4)' },
    prefix: '-',
  },
  personal: {
    label: 'PERSONAL',
    badgeStyle: { color: '#fff', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.05)' },
    amountStyle: { color: '#fff' },
    prefix: '-',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function TransactionItem({
  transaction, userName, onDelete, onEdit, compact = false, currentUserId,
}: TransactionItemProps) {
  const config = typeConfig[transaction.type];
  const isMine = transaction.type === 'personal'
    && transaction.userId !== undefined
    && currentUserId !== undefined
    && String(transaction.userId) === String(currentUserId);
  const isShared = transaction.type !== 'personal';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 16,
        background: '#0d0d0d',
        border: `1px solid rgba(255,255,255,${isMine ? '0.1' : '0.05'})`,
        transition: 'background 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#111'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#0d0d0d'; }}
    >
      {/* Left accent line for personal-mine */}
      {isMine && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#00ff41', borderRadius: '3px 0 0 3px' }} />
      )}

      {/* Type badge */}
      <span
        style={{
          ...config.badgeStyle,
          fontSize: 10, fontWeight: 700, padding: '3px 8px',
          borderRadius: 8, letterSpacing: '0.06em', flexShrink: 0,
          display: compact ? 'none' : 'inline-flex',
        }}
      >
        {config.label}
      </span>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {transaction.description || transaction.category}
          </p>
          {isMine && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#00ff41', background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.25)', borderRadius: 6, padding: '1px 5px', letterSpacing: '0.05em', flexShrink: 0 }}>YOU</span>
          )}
          {isShared && currentUserId && (
            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>shared</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDate(transaction.date)}
          </span>
          {userName && !compact && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{userName}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <span style={{ ...config.amountStyle, fontSize: 14, fontWeight: 700, letterSpacing: -0.3, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {config.prefix}{formatCurrency(transaction.amount)}
      </span>

      {(onEdit || onDelete) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            marginLeft: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              type="button"
              aria-label="Edit transaction"
              onClick={() => onEdit(transaction.id)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s, background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#00ff41';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,65,0.12)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,255,65,0.25)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <Pencil size={16} strokeWidth={2} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete transaction"
              onClick={() => onDelete(transaction.id)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s, background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#ff0033';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,0,51,0.1)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,0,51,0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
