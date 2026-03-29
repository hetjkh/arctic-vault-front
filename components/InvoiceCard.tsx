import { LegacyFlatInvoice } from '@/types';
import { formatCurrency } from '@/lib/calculations';

interface InvoiceCardProps {
  invoice: LegacyFlatInvoice;
  onMarkSent?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
}

const statusConfig = {
  draft: {
    label: 'DRAFT',
    style: { color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)' },
  },
  sent: {
    label: 'SENT',
    style: { color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.08)' },
  },
  paid: {
    label: 'PAID',
    style: { color: '#00ff41', border: '1px solid rgba(0,255,65,0.4)', background: 'rgba(0,255,65,0.07)', textShadow: '0 0 8px rgba(0,255,65,0.5)' },
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function InvoiceCard({ invoice, onMarkSent, onMarkPaid }: InvoiceCardProps) {
  const status = statusConfig[invoice.status];

  return (
    <div className="rounded-xl bg-[#0d0d0d] border border-white/10 p-5 hover:bg-[#111] hover:border-white/20 transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{invoice.clientName}</p>
          <p className="text-xs text-white/30 mt-0.5 truncate">{invoice.description || 'No description'}</p>
        </div>
        <span
          className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg tracking-wider"
          style={status.style}
        >
          {status.label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p
            className="text-xl font-bold font-mono"
            style={
              invoice.status === 'paid'
                ? { color: '#00ff41', textShadow: '0 0 10px rgba(0,255,65,0.5)' }
                : { color: '#ffffff' }
            }
          >
            {formatCurrency(invoice.amount)}
          </p>
          <p className="text-xs text-white/20 mt-0.5 font-mono">Created {formatDate(invoice.createdAt)}</p>
        </div>

        <div className="flex gap-2">
          {invoice.status === 'draft' && onMarkSent && (
            <button
              onClick={() => onMarkSent(invoice.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider transition-all border border-white/20 text-white hover:bg-white hover:text-black"
            >
              MARK SENT
            </button>
          )}
          {invoice.status === 'sent' && onMarkPaid && (
            <button
              onClick={() => onMarkPaid(invoice.id)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider transition-all"
              style={{
                color: '#00ff41',
                border: '1px solid rgba(0,255,65,0.5)',
                background: 'rgba(0,255,65,0.07)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,65,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,65,0.07)';
              }}
            >
              MARK PAID
            </button>
          )}
          {invoice.status === 'paid' && invoice.paidAt && (
            <span className="text-xs font-mono text-white/30">Paid {formatDate(invoice.paidAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
