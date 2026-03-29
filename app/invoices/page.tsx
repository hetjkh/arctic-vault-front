'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Invoice } from '@/types';
import { Plus, CheckCircle } from 'lucide-react';
import InvoiceDocument, { type InvoiceDocProps } from '@/components/InvoiceDocument';
import InvoiceWizard from '@/components/InvoiceWizard';
import { BACKEND_URL } from '@/lib/backend';

const statusCfg = {
  draft: { label: 'Draft', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.04)' },
  sent: { label: 'Sent', color: '#ffffff', border: 'rgba(255,255,255,0.25)', bg: 'rgba(255,255,255,0.08)' },
  paid: { label: 'Paid', color: '#00ff41', border: 'rgba(0,255,65,0.35)', bg: 'rgba(0,255,65,0.08)' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function invoiceToDocProps(inv: Invoice): InvoiceDocProps {
  return {
    invoiceNumber: inv.invoiceNumber,
    title: inv.title?.trim() || inv.billing.name,
    companyName: inv.from.name,
    from: inv.from,
    billing: inv.billing,
    items: inv.items,
    payment: inv.payment,
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total,
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/invoices`);
      if (!r.ok) throw new Error('Failed to load invoices');
      const data = (await r.json()) as Invoice[];
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${BACKEND_URL}/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const docPropsList = useMemo(() => {
    if (!invoices?.length) return [];
    return invoices.map((inv) => ({ inv, props: invoiceToDocProps(inv) }));
  }, [invoices]);

  if (loading || invoices === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid #00ff41',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const paid = invoices.filter((i) => i.status === 'paid').length;

  return (
    <div className="md:px-8 md:py-7" style={{ padding: '20px 16px 0' }}>
      <main>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Invoices</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
              {invoices.length} total · {paid} paid
              {loadError ? (
                <span style={{ color: 'rgba(255,80,80,0.9)', marginLeft: 8 }}>· {loadError}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#00ff41',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0,255,65,0.4)',
            }}
          >
            <Plus size={20} strokeWidth={3} color="#000" />
          </button>
        </div>

        {invoices.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 16px',
              background: '#111',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.05)',
              marginBottom: 24,
            }}
          >
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', margin: '0 0 16px' }}>No invoices yet</p>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              style={{
                padding: '10px 20px',
                background: '#00ff41',
                color: '#000',
                borderRadius: 100,
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Create invoice
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {invoices.map((inv) => {
                const sc = statusCfg[inv.status];
                return (
                  <div
                    key={inv.id}
                    style={{
                      background: '#111',
                      borderRadius: 16,
                      border: `1px solid ${inv.status === 'paid' ? 'rgba(0,255,65,0.12)' : 'rgba(255,255,255,0.06)'}`,
                      padding: '14px 16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: '#fff' }}>
                          {inv.billing.name}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                          #{inv.invoiceNumber} · AED {inv.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ·{' '}
                          {inv.paidAt ? `Paid ${fmt(inv.paidAt)}` : `Created ${fmt(inv.createdAt)}`}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 100,
                          border: `1px solid ${sc.border}`,
                          background: sc.bg,
                          color: sc.color,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {sc.label.toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {inv.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(inv.id, 'sent')}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 100,
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Mark Sent
                          </button>
                        )}
                        {inv.status === 'sent' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(inv.id, 'paid')}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 100,
                              border: '1px solid rgba(0,255,65,0.4)',
                              background: 'rgba(0,255,65,0.1)',
                              color: '#00ff41',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 0 10px rgba(0,255,65,0.15)',
                            }}
                          >
                            Mark Paid
                          </button>
                        )}
                        {inv.status === 'paid' && <CheckCircle size={20} color="#00ff41" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <section aria-label="Invoice previews" className="flex flex-col gap-10 pb-16">
              {docPropsList.map(({ inv, props }) => (
                <div key={inv.id} className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <InvoiceDocument {...props} />
                </div>
              ))}
            </section>
          </>
        )}

        <InvoiceWizard open={showWizard} onClose={() => setShowWizard(false)} onCreated={load} />
      </main>
    </div>
  );
}
