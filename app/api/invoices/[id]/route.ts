import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { LegacyFlatInvoice, Transaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await readDB();

    const idx = data.invoices.findIndex((inv: LegacyFlatInvoice) => inv.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const oldStatus = data.invoices[idx].status;
    const newStatus = body.status;
    data.invoices[idx] = { ...data.invoices[idx], status: newStatus };

    // Auto-create income transaction when invoice is first marked paid
    if (newStatus === 'paid' && oldStatus !== 'paid') {
      const invoice = data.invoices[idx] as LegacyFlatInvoice;
      const tx: Transaction = {
        id: uuidv4(),
        type: 'income',
        category: 'Invoice Payment',
        amount: invoice.amount,
        description: `Payment from ${invoice.clientName}: ${invoice.description}`,
        date: new Date().toISOString(),
        invoiceId: invoice.id,
      };
      data.transactions.unshift(tx);
      data.invoices[idx].paidAt = new Date().toISOString();
    }

    await writeDB(data);
    return NextResponse.json(data.invoices[idx]);
  } catch {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
