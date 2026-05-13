import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { Transaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const data = await readDB();
    return NextResponse.json(data.transactions);
  } catch {
    return NextResponse.json({ error: 'Failed to read transactions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await readDB();

    const rawUserId = body.userId;
    const coercedUserId =
      rawUserId === undefined || rawUserId === null
        ? undefined
        : Number(rawUserId);
    const userId =
      coercedUserId !== undefined && Number.isFinite(coercedUserId)
        ? coercedUserId
        : undefined;

    const tx: Transaction = {
      id: uuidv4(),
      type: body.type,
      category: body.category || 'General',
      amount: Number(body.amount),
      description: body.description || '',
      userId,
      date: new Date().toISOString(),
      invoiceId: body.invoiceId ?? undefined,
    };

    data.transactions.unshift(tx);
    await writeDB(data);

    return NextResponse.json(tx, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add transaction' }, { status: 500 });
  }
}
