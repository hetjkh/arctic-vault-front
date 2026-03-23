'use client';

import { useCallback, useEffect, useState } from 'react';
import { DBData, Invoice } from '@/types';
import { formatCurrency } from '@/lib/calculations';
import { Plus, X, CheckCircle } from 'lucide-react';

const statusCfg = {
  draft: { label: 'Draft', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)' },
  sent: { label: 'Sent', color: '#ffffff', border: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.08)' },
  paid: { label: 'Paid', color: '#00ff41', border: 'rgba(0,255,65,0.35)', bg: 'rgba(0,255,65,0.08)' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function InvoicesPage() {
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [invType, setInvType] = useState<'official' | 'settlement'>('official');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/data');
    setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, description, amount: parseFloat(amount), type: invType }),
    });
    setClientName(''); setDescription(''); setAmount('');
    setShowForm(false); setSubmitting(false);
    load();
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #00ff41', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const paid = data.invoices.filter((i: Invoice) => i.status === 'paid').length;
  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d',
    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14,
    padding: '14px 16px', fontSize: 15, color: '#fff', fontFamily: 'inherit',
  };

  return (
    <div className="md:px-8 md:py-7" style={{ padding: '20px 16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Invoices</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>{data.invoices.length} total · {paid} paid</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#00ff41', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,255,65,0.4)',
          }}
        >
          <Plus size={20} strokeWidth={3} color="#000" />
        </button>
      </div>

      {/* Invoice list */}
      {data.invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', background: '#111', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', margin: '0 0 16px' }}>No invoices yet</p>
          <button
            onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', background: '#00ff41', color: '#000', borderRadius: 100, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Create invoice
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.invoices.map((inv: Invoice) => {
            const sc = statusCfg[inv.status];
            return (
              <div
                key={inv.id}
                style={{
                  background: '#111', borderRadius: 20,
                  border: `1px solid ${inv.status === 'paid' ? 'rgba(0,255,65,0.12)' : 'rgba(255,255,255,0.06)'}`,
                  padding: '18px 18px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 3px', color: '#fff' }}>{inv.clientName}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{inv.description || 'No description'}</p>
                  </div>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px',
                      borderRadius: 100, border: `1px solid ${sc.border}`,
                      background: sc.bg, color: sc.color, letterSpacing: '0.05em',
                      flexShrink: 0, marginLeft: 8,
                    }}
                  >
                    {sc.label.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p
                      style={{
                        fontSize: 22, fontWeight: 800, margin: '0 0 2px',
                        color: inv.status === 'paid' ? '#00ff41' : '#fff',
                        textShadow: inv.status === 'paid' ? '0 0 12px rgba(0,255,65,0.4)' : 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCurrency(inv.amount)}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                      {inv.paidAt ? `Paid ${fmt(inv.paidAt)}` : `Created ${fmt(inv.createdAt)}`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {inv.status === 'draft' && (
                      <button
                        onClick={() => updateStatus(inv.id, 'sent')}
                        style={{
                          padding: '8px 14px', borderRadius: 100,
                          border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)',
                          color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Mark Sent
                      </button>
                    )}
                    {inv.status === 'sent' && (
                      <button
                        onClick={() => updateStatus(inv.id, 'paid')}
                        style={{
                          padding: '8px 14px', borderRadius: 100,
                          border: '1px solid rgba(0,255,65,0.4)', background: 'rgba(0,255,65,0.1)',
                          color: '#00ff41', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 0 10px rgba(0,255,65,0.15)',
                        }}
                      >
                        Mark Paid
                      </button>
                    )}
                    {inv.status === 'paid' && (
                      <CheckCircle size={20} color="#00ff41" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 480,
              background: '#111', borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px 20px 40px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New Invoice</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" style={inputStyle} required />
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" style={inputStyle} />
              <input type="number" min="1" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" style={inputStyle} required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['official', 'settlement'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInvType(t)}
                    style={{
                      padding: '12px', borderRadius: 14,
                      border: `1.5px solid ${invType === t ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      background: invType === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: invType === t ? '#fff' : 'rgba(255,255,255,0.35)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '15px', borderRadius: 16, border: 'none',
                  background: '#00ff41', color: '#000',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(0,255,65,0.3)', marginTop: 4,
                }}
              >
                {submitting ? 'Creating…' : 'Create Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
