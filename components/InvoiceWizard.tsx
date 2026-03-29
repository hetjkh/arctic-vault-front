'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { BACKEND_URL } from '@/lib/backend';
import { DEFAULT_INVOICE_FROM, invoiceDocDefaults } from '@/components/InvoiceDocument';
import type { InvoiceBilling, InvoiceFromData, InvoiceLineItemRow, InvoicePayment } from '@/types';

const STEPS = [
  'Invoice details',
  'Bill to (client)',
  'From (your company)',
  'Line items & tax',
  'Payment',
  'Review',
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  color: '#fff',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 6,
  textTransform: 'uppercase',
};

function emptyItem(): InvoiceLineItemRow {
  return { product: '', description: '', quantity: 1, price: 0 };
}

function cloneFrom(): InvoiceFromData {
  return {
    name: DEFAULT_INVOICE_FROM.name,
    addressLines: [...DEFAULT_INVOICE_FROM.addressLines],
    phone: DEFAULT_INVOICE_FROM.phone,
    email: DEFAULT_INVOICE_FROM.email,
    gst: DEFAULT_INVOICE_FROM.gst,
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function InvoiceWizard({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [title, setTitle] = useState('');
  const [invType, setInvType] = useState<'official' | 'settlement'>('official');
  const [billing, setBilling] = useState<InvoiceBilling>({
    name: '',
    address: '',
    tradeLicense: '',
    phone: '',
  });
  const [from, setFrom] = useState<InvoiceFromData>(cloneFrom);
  const [items, setItems] = useState<InvoiceLineItemRow[]>([emptyItem()]);
  const [tax, setTax] = useState(0);
  const [payment, setPayment] = useState<InvoicePayment>(() => ({ ...invoiceDocDefaults() }));

  const reset = useCallback(() => {
    setStep(0);
    setErr(null);
    setInvoiceNumber('');
    setBilling({ name: '', address: '', tradeLicense: '', phone: '' });
    setFrom(cloneFrom());
    setItems([emptyItem()]);
    setTax(0);
    setPayment({ ...invoiceDocDefaults() });
    setTitle('');
    setInvType('official');
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    setLoadingSuggest(true);
    fetch(`${BACKEND_URL}/api/invoices/suggest-number`)
      .then((r) => r.json())
      .then((d: { invoiceNumber?: string }) => setInvoiceNumber(d.invoiceNumber || '00001'))
      .catch(() => setInvoiceNumber('00001'))
      .finally(() => setLoadingSuggest(false));
  }, [open, reset]);

  const subtotal = useMemo(
    () =>
      items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0),
    [items]
  );

  const total = subtotal + (Number(tax) || 0);

  const validateStep = useCallback(
    (s: number): string | null => {
      switch (s) {
        case 0:
          if (!invoiceNumber.trim()) return 'Invoice number is required';
          return null;
        case 1:
          if (!billing.name.trim()) return 'Client name is required';
          return null;
        case 2:
          if (!from.name.trim()) return 'Company name is required';
          return null;
        case 3: {
          const ok = items.some(
            (it) => it.product.trim() && Number(it.price) > 0 && Number(it.quantity) > 0
          );
          if (!ok) return 'Add at least one line with product, quantity, and price';
          return null;
        }
        default:
          return null;
      }
    },
    [invoiceNumber, billing.name, from.name, items]
  );

  const next = () => {
    const e = validateStep(step);
    if (e) {
      setErr(e);
      return;
    }
    setErr(null);
    setStep((x) => Math.min(x + 1, STEPS.length - 1));
  };

  const back = () => {
    setErr(null);
    setStep((x) => Math.max(x - 1, 0));
  };

  const submit = async () => {
    const e = validateStep(3);
    if (e) {
      setErr(e);
      setStep(3);
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          title: title.trim(),
          type: invType,
          billing,
          from: {
            ...from,
            addressLines: from.addressLines.filter((l) => String(l).trim()),
          },
          items: items.map((it) => ({
            product: it.product,
            description: it.description,
            quantity: Number(it.quantity) || 0,
            price: Number(it.price) || 0,
          })),
          subtotal,
          tax: Number(tax) || 0,
          total,
          currency: 'AED',
          payment,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(data.error || 'Failed to create invoice');
      onCreated();
      onClose();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const updateItem = (i: number, patch: Partial<InvoiceLineItemRow>) => {
    setItems((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#111',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-wizard-title"
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            margin: '12px auto 0',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 id="invoice-wizard-title" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              New invoice
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: i <= step ? '#00ff41' : 'rgba(255,255,255,0.08)',
                  opacity: i <= step ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {err && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,0,51,0.12)',
                border: '1px solid rgba(255,0,51,0.25)',
                color: '#ff6b7a',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {err}
            </div>
          )}

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={labelStyle}>Invoice number</div>
                <input
                  style={inputStyle}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder={loadingSuggest ? 'Loading…' : '00001'}
                  disabled={loadingSuggest}
                />
              </div>
              <div>
                <div style={labelStyle}>Title (optional)</div>
                <input
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Website assets"
                />
              </div>
              <div>
                <div style={labelStyle}>Invoice type</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['official', 'settlement'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInvType(t)}
                      style={{
                        padding: '12px',
                        borderRadius: 14,
                        border: `1.5px solid ${invType === t ? 'rgba(0,255,65,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: invType === t ? 'rgba(0,255,65,0.08)' : 'transparent',
                        color: invType === t ? '#00ff41' : 'rgba(255,255,255,0.35)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['name', 'address', 'tradeLicense', 'phone'] as const).map((field) => (
                <div key={field}>
                  <div style={labelStyle}>
                    {field === 'name'
                      ? 'Client name'
                      : field === 'address'
                        ? 'Address'
                        : field === 'tradeLicense'
                          ? 'Trade license'
                          : 'Phone'}
                  </div>
                  {field === 'address' ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      value={billing.address}
                      onChange={(e) => setBilling({ ...billing, address: e.target.value })}
                      placeholder="Street, city, country"
                    />
                  ) : (
                    <input
                      style={inputStyle}
                      value={billing[field]}
                      onChange={(e) => setBilling({ ...billing, [field]: e.target.value })}
                      placeholder=""
                      required={field === 'name'}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={labelStyle}>Company name</div>
                <input
                  style={inputStyle}
                  value={from.name}
                  onChange={(e) => setFrom({ ...from, name: e.target.value })}
                />
              </div>
              <div>
                <div style={labelStyle}>Address lines (one per line)</div>
                <textarea
                  style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                  value={from.addressLines.join('\n')}
                  onChange={(e) =>
                    setFrom({ ...from, addressLines: e.target.value.split('\n') })
                  }
                />
              </div>
              <div>
                <div style={labelStyle}>Phone</div>
                <input
                  style={inputStyle}
                  value={from.phone}
                  onChange={(e) => setFrom({ ...from, phone: e.target.value })}
                />
              </div>
              <div>
                <div style={labelStyle}>Email</div>
                <input
                  style={inputStyle}
                  type="email"
                  value={from.email}
                  onChange={(e) => setFrom({ ...from, email: e.target.value })}
                />
              </div>
              <div>
                <div style={labelStyle}>GST number</div>
                <input
                  style={inputStyle}
                  value={from.gst}
                  onChange={(e) => setFrom({ ...from, gst: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((row, i) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
                      Line {i + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255,255,255,0.25)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    style={{ ...inputStyle, marginBottom: 8 }}
                    placeholder="Product"
                    value={row.product}
                    onChange={(e) => updateItem(i, { product: e.target.value })}
                  />
                  <input
                    style={{ ...inputStyle, marginBottom: 8 }}
                    placeholder="Description"
                    value={row.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      style={inputStyle}
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Qty"
                      value={row.quantity || ''}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                    />
                    <input
                      style={inputStyle}
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Price (AED)"
                      value={row.price || ''}
                      onChange={(e) => updateItem(i, { price: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 12,
                  borderRadius: 14,
                  border: '1px dashed rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} /> Add line
              </button>
              <div>
                <div style={labelStyle}>Tax amount (AED)</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={0}
                  step="any"
                  value={tax || ''}
                  onChange={(e) => setTax(Number(e.target.value) || 0)}
                />
              </div>
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(0,255,65,0.06)',
                  border: '1px solid rgba(0,255,65,0.15)',
                }}
              >
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Subtotal</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>AED {subtotal.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>Total (incl. tax)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#00ff41' }}>AED {total.toFixed(2)}</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(
                [
                  ['holder', 'Account holder'],
                  ['accountNumber', 'Account number'],
                  ['bank', 'Bank'],
                  ['ifsc', 'IFSC'],
                  ['swift', 'SWIFT / BIC'],
                  ['mobile', 'Mobile'],
                ] as const
              ).map(([key, lab]) => (
                <div key={key}>
                  <div style={labelStyle}>{lab}</div>
                  <input
                    style={inputStyle}
                    value={payment[key]}
                    onChange={(e) => setPayment({ ...payment, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#00ff41' }}>Ready to create</p>
              <p style={{ margin: '0 0 12px' }}>
                <strong>Invoice #</strong> {invoiceNumber}
                {title ? (
                  <>
                    {' '}
                    · <strong>Title</strong> {title}
                  </>
                ) : null}
              </p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Bill to:</strong> {billing.name}
              </p>
              <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.45)' }}>{billing.address}</p>
              <p style={{ margin: '0 0 6px' }}>
                <strong>From:</strong> {from.name}
              </p>
              <p style={{ margin: '0 0 12px' }}>
                <strong>Lines:</strong> {items.length} · <strong>Total</strong> AED {total.toFixed(2)}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Saved as <strong>draft</strong>. You can mark sent / paid from the list.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 20px 28px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 14,
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={18} /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              style={{
                flex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 14,
                borderRadius: 16,
                border: 'none',
                background: '#00ff41',
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                flex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 14,
                borderRadius: 16,
                border: 'none',
                background: submitting ? 'rgba(0,255,65,0.4)' : '#00ff41',
                color: '#000',
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create invoice'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
