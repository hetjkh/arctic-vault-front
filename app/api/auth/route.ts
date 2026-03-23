import { NextRequest, NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { userId, pin } = await req.json();
  const data = await readDB();
  const user = data.users.find((u) => u.id === Number(userId));

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (String(user.pin) !== String(pin)) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    fullName: user.fullName ?? user.name,
  });
}
