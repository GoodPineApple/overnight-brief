import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { signToken, sessionCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  const { data: user } = await db
    .from('users')
    .select('id, email, password_hash')
    .eq('email', email)
    .single();

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const token = await signToken({ sub: user.id, email: user.email });
  const cookie = sessionCookieOptions(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
