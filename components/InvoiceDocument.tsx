'use client';

import Image from 'next/image';
import { Poppins } from 'next/font/google';
import { useCallback, useState } from 'react';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export type InvoiceLineItem = {
  product: string;
  description: string;
  quantity: number;
  price: number;
};

export type InvoiceFrom = {
  name: string;
  addressLines: string[];
  phone: string;
  email: string;
  gst: string;
};

/** Default sender details (Arctic Base); override via `from` on `InvoiceDocProps`. */
export const DEFAULT_INVOICE_FROM: InvoiceFrom = {
  name: 'ArcticBase',
  addressLines: [
    '17 ,guru govind bag society,',
    'khokrah gayatri dairy ,',
    'Ahemdabad , Gujarat',
  ],
  phone: '+91 90167 43347',
  email: 'arcticbase.org@gmail.com',
  gst: '24DAKPGJ8980DIZG',
};

export type InvoiceDocProps = {
  invoiceNumber: string;
  title: string;
  /** Sender; defaults to {@link DEFAULT_INVOICE_FROM} */
  from?: Partial<InvoiceFrom>;
  billing: {
    name: string;
    address: string;
    tradeLicense: string;
    phone: string;
  };
  items: InvoiceLineItem[];
  payment: {
    holder: string;
    accountNumber: string;
    bank: string;
    ifsc: string;
    swift: string;
    mobile: string;
  };
  subtotal: number;
  tax: number;
  total: number;
  companyName?: string;
};

const DEFAULT_PAYMENT: InvoiceDocProps['payment'] = {
  holder: 'RONIT KAUSHAL',
  accountNumber: '110035229021',
  bank: 'Canara Bank',
  ifsc: 'CNRB0017081',
  swift: 'CNRBINBBBFD',
  mobile: '+919104320305',
};

export function invoiceDocDefaults(): InvoiceDocProps['payment'] {
  return { ...DEFAULT_PAYMENT };
}

function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [ok, setOk] = useState(true);
  const onError = useCallback(() => setOk(false), []);

  if (!ok) {
    return <>{fallback}</>;
  }

  return (
    <Image
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      onError={onError}
      unoptimized
    />
  );
}

export default function InvoiceDocument({
  invoiceNumber,
  title: _title,
  from: fromProp,
  billing,
  items,
  payment,
  subtotal,
  tax,
  total,
  companyName = 'ARCTIC BASE',
}: InvoiceDocProps) {
  const taxPct = subtotal > 0 ? ((tax / subtotal) * 100).toFixed(2) : '0.00';
  const from = { ...DEFAULT_INVOICE_FROM, ...fromProp };

  return (
    <div className="invoice-document-root p-4 md:p-8 print:p-0 print:bg-white print:text-black">
      <div
        className={`invoice-paper ${poppins.className} w-full max-w-[21cm] min-h-[29.7cm] relative shadow-lg mx-auto text-sm flex flex-col print:shadow-none print:max-w-none`}
      >
        <header className="flex justify-between items-start pb-6 w-full shrink-0">
          <div className="w-full">
            <div className="flex justify-between items-center w-full">
              <h1 className="invoice-strip text-3xl md:text-4xl mt-3 md:mt-5 pl-6 md:pl-12 pr-4 md:pr-5 py-4 md:py-5 font-bold tracking-tighter">
                INVOICE
              </h1>

              <div className="pr-4 md:pr-12 shrink-0 flex items-center justify-end">
                <SafeImage
                  className="pr-0 h-[76px] w-auto max-h-[76px] max-w-[240px] md:h-[96px] md:max-h-[96px] md:max-w-[300px] object-contain object-right"
                  src="/Arctic_Base_logo_Black.png"
                  alt={companyName}
                  width={360}
                  height={120}
                  fallback={
                    <div className="text-right font-bold tracking-tight text-xl md:text-3xl max-w-[300px] leading-tight text-[var(--invoice-text)]">
                      {companyName}
                    </div>
                  }
                />
              </div>
            </div>
            <div className="flex justify-end w-full px-6 md:px-12 pt-1">
              <p className="text-lg md:text-xl font-medium text-[var(--invoice-text-secondary)]">
                <strong className="text-[var(--invoice-text)]">INVOICE</strong> {invoiceNumber}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6 md:mt-8 w-full px-6 md:px-12 text-[var(--invoice-text)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider mb-2">BILLING TO:</h3>
              <p className="font-bold">{billing.name}</p>
              <p className="text-[var(--invoice-text-secondary)]">{billing.address}</p>
              <p className="text-[var(--invoice-text-secondary)]">Trade license no: {billing.tradeLicense}</p>
              <p className="text-[var(--invoice-text-secondary)]">Phone: {billing.phone}</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider mb-2">FROM</h3>
              <p className="font-bold text-[var(--invoice-text)]">{from.name}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--invoice-text-secondary)] mt-3 mb-1">
                ADDRESS:
              </p>
              {from.addressLines.map((line, i) => (
                <p key={i} className="text-[var(--invoice-text-secondary)] leading-snug">
                  {line}
                </p>
              ))}
              <p className="text-[var(--invoice-text-secondary)] mt-2">
                Phone: {from.phone}
              </p>
              <p className="text-[var(--invoice-text-secondary)]">Email: {from.email}</p>
              <p className="text-[var(--invoice-text-secondary)] mt-1">GST NO: {from.gst}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 md:mt-10 w-full px-6 md:px-12 overflow-x-auto">
          <table className="w-full border-collapse min-w-[280px]">
            <thead>
              <tr>
                <th className="invoice-th-border text-left text-base md:text-xl font-bold uppercase tracking-wider pb-2 text-[var(--invoice-text)]">
                  PRODUCT
                </th>
                <th className="invoice-th-border text-center text-base md:text-xl font-bold uppercase tracking-wider pb-2 text-[var(--invoice-text)]">
                  QTY
                </th>
                <th className="invoice-th-border text-center text-base md:text-xl font-bold uppercase tracking-wider pb-2 text-[var(--invoice-text)]">
                  PRICE
                </th>
                <th className="invoice-th-border text-center text-base md:text-xl font-bold uppercase tracking-wider pb-2 text-[var(--invoice-text)]">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="invoice-row-border text-[var(--invoice-text)]">
                  <td className="py-3 md:py-4 align-top">
                    <strong className="block mb-0.5">{item.product}</strong>
                    <span className="invoice-muted text-xs md:text-sm">{item.description}</span>
                  </td>
                  <td className="py-3 md:py-4 text-center align-top">{item.quantity}</td>
                  <td className="py-3 md:py-4 text-center align-top">AED {item.price}</td>
                  <td className="py-3 md:py-4 text-center align-top">
                    AED {item.price * item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8 md:mt-10 flex justify-end items-start px-6 md:px-12 text-[var(--invoice-text)]">
          <table className="w-full sm:w-2/5">
            <tbody>
              <tr className="invoice-row-border text-sm">
                <td className="py-3 md:py-4 pr-2">SUB TOTAL</td>
                <td className="py-3 md:py-4 text-right">AED {subtotal}</td>
              </tr>
              <tr className="invoice-row-border text-sm">
                <td className="py-3 md:py-4 pr-2">TAX ({taxPct}%)</td>
                <td className="py-3 md:py-4 text-right">AED {tax.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="font-bold text-base md:text-lg py-2">TOTAL</td>
                <td className="text-right font-bold text-sm md:text-base">AED {total}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="mt-auto pt-8 md:pt-10 flex flex-col justify-between items-stretch print:mt-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end w-full px-6 md:px-12 gap-8">
            <div className="w-full md:w-[50%] pr-0 md:pr-4 text-[var(--invoice-text)]">
              <h4 className="text-sm font-bold uppercase tracking-wider mb-2">
                PAYMENT DETAILS:
              </h4>
              <div className="text-xs leading-relaxed text-[var(--invoice-text-secondary)]">
                <p>
                  <strong className="text-[var(--invoice-text)]">Account Holder Name:</strong> {payment.holder}
                </p>
                <p>
                  <strong className="text-[var(--invoice-text)]">Account Number:</strong> {payment.accountNumber}
                </p>
                <p>
                  <strong className="text-[var(--invoice-text)]">Bank Name:</strong> {payment.bank}
                </p>
                <p>
                  <strong className="text-[var(--invoice-text)]">IFSC Code:</strong> {payment.ifsc}
                </p>
                <p>
                  <strong className="text-[var(--invoice-text)]">SWIFT/BIC Code:</strong> {payment.swift}
                </p>
                <p>
                  <strong className="text-[var(--invoice-text)]">Mobile Number:</strong> {payment.mobile}
                </p>
              </div>
            </div>
            <div className="w-full md:w-[50%] flex flex-col justify-end items-start md:items-end text-[var(--invoice-text)]">
              <SafeImage
                src="/Ronit_signature.png"
                alt="Signature"
                width={140}
                height={56}
                className="object-contain object-right h-[36px] w-auto max-h-[36px] max-w-[110px] md:h-[44px] md:max-h-[44px] md:max-w-[130px]"
                fallback={
                  <div className="h-9 w-full max-w-[130px] invoice-row-border text-xs invoice-muted flex items-end pb-1">
                    Signature
                  </div>
                }
              />

              <p className="pt-2 mt-1 text-sm font-bold">Authorised Signatory</p>
            </div>
          </div>

          <div className="invoice-strip flex justify-start items-start flex-col mt-5 w-full text-right px-6 md:px-12 py-4 md:py-5">
            <h4 className="text-base font-bold text-left">Thank you for your trust and support!</h4>
            <p className="text-sm mt-1 text-left w-full text-[var(--invoice-text-secondary)]">
              We truly appreciate the opportunity to work with you. If you have any questions
              regarding this invoice or future projects, please feel free to reach out anytime.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
