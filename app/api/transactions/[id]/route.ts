import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = await readDB();

    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    let updated = { ...data.transactions[idx], ...body };
    if ('userId' in body && (body.userId === null || body.userId === '')) {
      updated = { ...updated, userId: undefined };
    } else if (updated.userId != null && updated.userId !== '') {
      const n = Number(updated.userId);
      updated = { ...updated, userId: Number.isFinite(n) ? n : undefined };
    }
    data.transactions[idx] = updated;
    await writeDB(data);

    return NextResponse.json(data.transactions[idx]);
  } catch {
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const data = await readDB();

    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    data.transactions.splice(idx, 1);
    await writeDB(data);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
