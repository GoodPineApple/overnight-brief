import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/mailer';

function generateCode(): string {
  return randomInt(100000, 999999).toString();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  const { data: existing, error: lookupErr } = await db
    .from('users')
    .select('id, provider')
    .eq('email', email)
    .maybeSingle();

  if (lookupErr) {
    console.error('[signup] lookup error:', lookupErr);
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (existing) {
    if (existing.provider === 'google') {
      return NextResponse.json(
        { error: '해당 이메일은 Google 계정으로 가입되어 있습니다. Google 로그인을 이용해주세요.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 기존 인증 요청 삭제 후 새로 생성
  await db.from('email_verifications').delete().eq('email', email);

  const { error: insertVerifErr } = await db.from('email_verifications').insert({
    email,
    code,
    password_hash: passwordHash,
    expires_at: expiresAt,
  });

  if (insertVerifErr) {
    console.error('[signup] email_verifications insert error:', insertVerifErr);
    const hint =
      insertVerifErr.code === '42501'
        ? ' Supabase SQL 에디터에서 supabase/migrations/0004_grants.sql을 실행해주세요.'
        : '';
    return NextResponse.json({ error: `인증 코드 저장에 실패했습니다.${hint}` }, { status: 500 });
  }

  // 인증 메일 발송
  try {
    await sendEmail(
      email,
      '[Overnight Brief] 이메일 인증 코드',
      `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="margin-bottom: 8px;">이메일 인증</h2>
        <p style="color: #666; margin-bottom: 24px;">아래 인증 코드를 입력하여 회원가입을 완료해주세요.</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</span>
        </div>
        <p style="color: #999; font-size: 12px;">이 코드는 10분간 유효합니다.</p>
      </div>
      `,
    );
  } catch (err) {
    console.error('[signup] 이메일 발송 실패:', err);
    await db.from('email_verifications').delete().eq('email', email);
    return NextResponse.json(
      { error: '인증 이메일 발송에 실패했습니다. Gmail 설정을 확인해주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: '인증 코드를 이메일로 발송했습니다.' });
}
