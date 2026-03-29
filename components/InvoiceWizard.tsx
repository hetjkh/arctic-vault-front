'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Columns2, Eye, FileEdit, Plus, Trash2, X } from 'lucide-react';
import { BACKEND_URL } from '@/lib/backend';
import InvoiceDocument, {
  DEFAULT_INVOICE_FROM,
  invoiceDocDefaults,
  type InvoiceDocProps,
} from '@/components/InvoiceDocument';
import type { Invoice, InvoiceBilling, InvoiceFromData, InvoiceLineItemRow, InvoicePayment } from '@/types';

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

const WIDE_BREAKPOINT = '(min-width: 1024px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const sync = () => setMatches(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after successful create or update */
  onSuccess: () => void;
  /** When set, wizard opens in edit mode and PUTs to `/api/invoices/:id` */
  invoiceToEdit?: Invoice | null;
};

function hydrateFromInvoice(inv: Invoice, setters: {
  setInvoiceNumber: (v: string) => void;
  setTitle: (v: string) => void;
  setInvType: (v: 'official' | 'settlement') => void;
  setBilling: (v: InvoiceBilling) => void;
  setFrom: (v: InvoiceFromData) => void;
  setItems: (v: InvoiceLineItemRow[]) => void;
  setTax: (v: number) => void;
  setPayment: (v: InvoicePayment) => void;
}) {
  const { setInvoiceNumber, setTitle, setInvType, setBilling, setFrom, setItems, setTax, setPayment } = setters;
  setInvoiceNumber(inv.invoiceNumber);
  setTitle(inv.title || '');
  setInvType(inv.type === 'settlement' ? 'settlement' : 'official');
  setBilling({ ...inv.billing });
  setFrom({
    name: inv.from.name,
    addressLines: [...(inv.from.addressLines || [])],
    phone: inv.from.phone,
    email: inv.from.email,
    gst: inv.from.gst,
  });
  setItems(
    inv.items?.length
      ? inv.items.map((it) => ({
          product: it.product,
          description: it.description || '',
          quantity: it.quantity,
          price: it.price,
        }))
      : [emptyItem()]
  );
  setTax(inv.tax ?? 0);
  setPayment({ ...inv.payment });
}

export default function InvoiceWizard({ open, onClose, onSuccess, invoiceToEdit = null }: Props) {
  const isEdit = Boolean(invoiceToEdit);
  const isWide = useMediaQuery(WIDE_BREAKPOINT);
  /** Form steps vs full A4 preview (live draft) — on narrow screens only; wide uses split + collapse */
  const [uiMode, setUiMode] = useState<'form' | 'preview'>('form');
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
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
    setUiMode('form');
    setPreviewCollapsed(false);
    setErr(null);
    setStep(0);
    if (invoiceToEdit) {
      setLoadingSuggest(false);
      hydrateFromInvoice(invoiceToEdit, {
        setInvoiceNumber,
        setTitle,
        setInvType,
        setBilling,
        setFrom,
        setItems,
        setTax,
        setPayment,
      });
      return;
    }
    reset();
    setLoadingSuggest(true);
    fetch(`${BACKEND_URL}/api/invoices/suggest-number`)
      .then((r) => r.json())
      .then((d: { invoiceNumber?: string }) => setInvoiceNumber(d.invoiceNumber || '00001'))
      .catch(() => setInvoiceNumber('00001'))
      .finally(() => setLoadingSuggest(false));
  }, [open, invoiceToEdit, reset]);

  const subtotal = useMemo(
    () =>
      items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0),
    [items]
  );

  const total = subtotal + (Number(tax) || 0);

  const previewDocProps: InvoiceDocProps = useMemo(() => {
    const hasLines = items.some((it) => it.product.trim() || Number(it.price) > 0);
    const lineItems = hasLines
      ? items.map((it) => ({
          product: it.product.trim() || 'Item',
          description: it.description || '',
          quantity: Math.max(0, Number(it.quantity) || 0),
          price: Math.max(0, Number(it.price) || 0),
        }))
      : [
          {
            product: '—',
            description: 'Add line items in the form (step 4)',
            quantity: 1,
            price: 0,
          },
        ];
    const subPreview = hasLines
      ? subtotal
      : 0;
    const taxN = Number(tax) || 0;
    const totalPreview = hasLines ? total : taxN;
    return {
      invoiceNumber: invoiceNumber.trim() || '00000',
      title: title.trim() || billing.name.trim() || 'Invoice',
      companyName: from.name.trim() || DEFAULT_INVOICE_FROM.name,
      from: {
        name: from.name.trim() || DEFAULT_INVOICE_FROM.name,
        addressLines:
          from.addressLines.filter((l) => String(l).trim()).length > 0
            ? from.addressLines
            : [...DEFAULT_INVOICE_FROM.addressLines],
        phone: from.phone || '—',
        email: from.email || '—',
        gst: from.gst || '—',
      },
      billing: {
        name: billing.name.trim() || 'Client name',
        address: billing.address.trim() || '—',
        tradeLicense: billing.tradeLicense.trim() || '—',
        phone: billing.phone.trim() || '—',
      },
      items: lineItems,
      payment,
      subtotal: subPreview,
      tax: taxN,
      total: totalPreview,
    };
  }, [invoiceNumber, title, billing, from, items, payment, subtotal, tax, total]);

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
    const body = {
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
    };
    try {
      const url = isEdit
        ? `${BACKEND_URL}/api/invoices/${invoiceToEdit!.id}`
        : `${BACKEND_URL}/api/invoices`;
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit ? { ...body, status: invoiceToEdit!.status } : body
        ),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(data.error || (isEdit ? 'Failed to save invoice' : 'Failed to create invoice'));
      onSuccess();
      onClose();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : isEdit ? 'Failed to save' : 'Failed to create');
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

  const segmentBtn = (active: boolean) =>
    ({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '10px 14px',
      borderRadius: 12,
      border: 'none',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'background 0.15s, color 0.15s',
      background: active ? 'rgba(0,255,65,0.18)' : 'transparent',
      color: active ? '#00ff41' : 'rgba(255,255,255,0.45)',
    }) as React.CSSProperties;

  const modeToggleStyle: React.CSSProperties = {
    display: 'flex',
    marginTop: 12,
    padding: 4,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const formFields = (
    <>
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
              disabled={loadingSuggest && !isEdit}
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
              onChange={(e) => setFrom({ ...from, addressLines: e.target.value.split('\n') })}
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
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#00ff41' }}>
            {isEdit ? 'Ready to save' : 'Ready to create'}
          </p>
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
          {!isEdit ? (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              Saved as <strong>draft</strong>. You can mark sent / paid from the list.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              Status stays <strong>{invoiceToEdit?.status}</strong> until you change it from the list.
            </p>
          )}
        </div>
      )}
    </>
  );

  const stepProgress = (
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
  );

  if (!open) return null;

  const previewBody = <InvoiceDocument {...previewDocProps} />;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isWide
          ? 20
          : 'max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        style={{
          width: '100%',
          maxWidth: isWide
            ? previewCollapsed
              ? 560
              : 1180
            : uiMode === 'preview'
              ? 720
              : 540,
          maxHeight: 'min(94vh, 900px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#111',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-wizard-title"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="invoice-wizard-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {isEdit ? 'Edit invoice' : 'New invoice'}
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>
              {isWide
                ? previewCollapsed
                  ? `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]} · Preview hidden`
                  : `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]} · Live preview beside the form`
                : uiMode === 'preview'
                  ? 'Live preview — switch to Form anytime to edit'
                  : `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
            </p>
            {isWide ? (
              <button
                type="button"
                onClick={() => setPreviewCollapsed((c) => !c)}
                style={{
                  marginTop: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: previewCollapsed ? '#00ff41' : 'rgba(255,255,255,0.85)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Columns2 size={16} />
                {previewCollapsed ? 'Show live preview' : 'Hide preview panel'}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {isWide ? (
          <>
            {stepProgress}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  flex: previewCollapsed ? 1 : '1 1 50%',
                  minWidth: 0,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: previewCollapsed ? undefined : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>{formFields}</div>
              </div>
              {!previewCollapsed ? (
                <div
                  style={{
                    flex: '1 1 50%',
                    minWidth: 0,
                    minHeight: 0,
                    background: '#0a0a0a',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.35)',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    Preview
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: 'auto',
                      overscrollBehavior: 'contain',
                      padding: '0 12px 16px',
                    }}
                  >
                    {previewBody}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {uiMode === 'form' ? stepProgress : null}
            <div
              style={{
                padding: uiMode === 'preview' ? 0 : '20px',
                overflowY: 'auto',
                flex: 1,
                background: uiMode === 'preview' ? '#0a0a0a' : undefined,
                minHeight: 0,
              }}
            >
              {uiMode === 'preview' ? (
                <div style={{ padding: '0 12px 16px' }}>{previewBody}</div>
              ) : (
                formFields
              )}
            </div>
          </>
        )}

        <div
          style={{
            padding: '12px 20px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {!isWide ? (
            <div style={{ ...modeToggleStyle, marginTop: 0 }}>
              <button type="button" style={segmentBtn(uiMode === 'form')} onClick={() => setUiMode('form')}>
                <FileEdit size={16} /> Form
              </button>
              <button type="button" style={segmentBtn(uiMode === 'preview')} onClick={() => setUiMode('preview')}>
                <Eye size={16} /> Preview
              </button>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
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
                  flex: step > 0 ? 2 : 1,
                  minWidth: 0,
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
                  flex: step > 0 ? 2 : 1,
                  minWidth: 0,
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
                {submitting ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create invoice'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
