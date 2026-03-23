import { NextRequest, NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { Settlement } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await readDB();

    const settlement: Settlement = {
      id: uuidv4(),
      fromUserId: Number(body.fromUserId),
      toUserId: Number(body.toUserId),
      amount: Number(body.amount),
      note: body.note ?? '',
      date: new Date().toISOString(),
    };

    data.settlements.unshift(settlement);
    await writeDB(data);

    return NextResponse.json(settlement, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to record settlement' }, { status: 500 });
  }
}
