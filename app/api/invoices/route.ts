import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { LegacyFlatInvoice } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const data = await readDB();
    return NextResponse.json(data.invoices);
  } catch {
    return NextResponse.json({ error: 'Failed to read invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await readDB();

    const invoice: LegacyFlatInvoice = {
      id: uuidv4(),
      clientName: body.clientName,
      description: body.description || '',
      amount: Number(body.amount),
      type: body.type || 'official',
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    data.invoices.unshift(invoice);
    await writeDB(data);

    return NextResponse.json(invoice, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
