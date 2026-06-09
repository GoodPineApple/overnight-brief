import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { signToken, sessionCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  const code = String(body.code ?? '').trim();

  if (!email || !code) {
    return NextResponse.json({ error: '이메일과 인증 코드를 입력해주세요.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  const { data: verification } = await db
    .from('email_verifications')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .single();

  if (!verification) {
    return NextResponse.json({ error: '인증 코드가 올바르지 않습니다.' }, { status: 400 });
  }

  if (new Date(verification.expires_at) < new Date()) {
    await db.from('email_verifications').delete().eq('id', verification.id);
    return NextResponse.json({ error: '인증 코드가 만료되었습니다. 다시 회원가입해주세요.' }, { status: 400 });
  }

  // 유저 생성
  const { data: user, error } = await db
    .from('users')
    .insert({
      email,
      password_hash: verification.password_hash,
      status: 'active',
      provider: 'email',
    })
    .select('id, email')
    .single();

  if (error || !user) {
    return NextResponse.json({ error: '계정 생성에 실패했습니다.' }, { status: 500 });
  }

  // 기본 이메일 채널 자동 등록
  await db.from('notification_channels').insert({
    user_id: user.id,
    type: 'email',
    destination: email,
    label: '기본 이메일',
    is_active: true,
  });

  // 인증 레코드 정리
  await db.from('email_verifications').delete().eq('email', email);

  // JWT 발급
  const token = await signToken({ sub: user.id, email: user.email });
  const cookie = sessionCookieOptions(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
