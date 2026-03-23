import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function GET() {
  try {
    const data = await readDB();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}
