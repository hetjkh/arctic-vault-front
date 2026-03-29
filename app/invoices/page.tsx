'use client';

import { useCallback, useEffect, useState } from 'react';
import { Invoice } from '@/types';
import { Plus, CheckCircle, Eye, Pencil, Trash2, X } from 'lucide-react';
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

const btnGhost: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const btnDanger: React.CSSProperties = {
  ...btnGhost,
  border: '1px solid rgba(255,80,80,0.35)',
  background: 'rgba(255,50,50,0.08)',
  color: '#ff8a8a',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteInvoice = async (inv: Invoice) => {
    const ok = window.confirm(
      `Delete invoice #${inv.invoiceNumber} for ${inv.billing.name}? This cannot be undone.`
    );
    if (!ok) return;
    setDeletingId(inv.id);
    try {
      const r = await fetch(`${BACKEND_URL}/api/invoices/${inv.id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || 'Delete failed');
      }
      if (viewInvoice?.id === inv.id) setViewInvoice(null);
      load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    setInvoiceToEdit(null);
    setWizardOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setInvoiceToEdit(inv);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setInvoiceToEdit(null);
  };

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
    <div className="md:px-8 md:py-7" style={{ padding: '20px 16px 24px' }}>
      <main>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
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
            onClick={openCreate}
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
            }}
          >
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', margin: '0 0 16px' }}>No invoices yet</p>
            <button
              type="button"
              onClick={openCreate}
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
          <div
            style={{
              background: '#0d0d0d',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '14px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Client
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '14px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Total
                    </th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: '14px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '14px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Updated
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '14px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const sc = statusCfg[inv.status];
                    const dateShow = inv.paidAt || inv.updatedAt || inv.createdAt;
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          verticalAlign: 'middle',
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '14px 12px', maxWidth: 220 }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{inv.billing.name}</div>
                          {inv.title ? (
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                              {inv.title}
                            </div>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: '14px 12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: '#fff',
                          }}
                        >
                          AED{' '}
                          {inv.total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 100,
                              border: `1px solid ${sc.border}`,
                              background: sc.bg,
                              color: sc.color,
                              letterSpacing: '0.05em',
                              display: 'inline-block',
                            }}
                          >
                            {sc.label.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 12px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                          {fmt(dateShow)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" style={btnGhost} onClick={() => setViewInvoice(inv)}>
                              <Eye size={15} /> View
                            </button>
                            <button type="button" style={btnGhost} onClick={() => openEdit(inv)}>
                              <Pencil size={15} /> Edit
                            </button>
                            <button
                              type="button"
                              style={btnDanger}
                              disabled={deletingId === inv.id}
                              onClick={() => deleteInvoice(inv)}
                            >
                              <Trash2 size={15} /> {deletingId === inv.id ? '…' : 'Delete'}
                            </button>
                            {inv.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(inv.id, 'sent')}
                                style={{
                                  ...btnGhost,
                                  border: '1px solid rgba(255,255,255,0.2)',
                                }}
                              >
                                Sent
                              </button>
                            )}
                            {inv.status === 'sent' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(inv.id, 'paid')}
                                style={{
                                  ...btnGhost,
                                  border: '1px solid rgba(0,255,65,0.45)',
                                  color: '#00ff41',
                                }}
                              >
                                Paid
                              </button>
                            )}
                            {inv.status === 'paid' && <CheckCircle size={18} color="#00ff41" style={{ alignSelf: 'center' }} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <InvoiceWizard
          open={wizardOpen}
          onClose={closeWizard}
          onSuccess={load}
          invoiceToEdit={invoiceToEdit}
        />

        {viewInvoice && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 150,
              background: 'rgba(0,0,0,0.9)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Invoice preview"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 4px 16px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                Invoice #{viewInvoice.invoiceNumber} · {viewInvoice.billing.name}
              </span>
              <button
                type="button"
                onClick={() => setViewInvoice(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: 10,
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', borderRadius: 16 }}>
              <InvoiceDocument {...invoiceToDocProps(viewInvoice)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
