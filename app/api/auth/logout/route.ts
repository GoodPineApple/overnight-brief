import { NextResponse } from 'next/server';
import { deleteSessionCookieOptions } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(deleteSessionCookieOptions());
  return res;
}
