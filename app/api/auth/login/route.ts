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

  const { data: user, error: lookupErr } = await db
    .from('users')
    .select('id, email, password_hash, provider, status')
    .eq('email', email)
    .maybeSingle();

  if (lookupErr) {
    console.error('[login] lookup error:', lookupErr);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  if (user.status === 'inactive') {
    return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의해주세요.' }, { status: 403 });
  }

  // Google 소셜 로그인으로만 가입된 계정
  if (user.provider === 'google' && !user.password_hash) {
    return NextResponse.json(
      { error: '해당 계정은 Google 로그인으로 가입되었습니다. Google 로그인을 이용해주세요.' },
      { status: 401 },
    );
  }

  if (!user.password_hash) {
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
