import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { signToken, sessionCookieOptions } from '@/lib/auth';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
  );
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${origin}/auth/login?error=google_auth_failed`);
  }

  const oauth2Client = getOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return NextResponse.redirect(`${origin}/auth/login?error=no_email`);
    }

    const db = createSupabaseAdminClient();
    const email = profile.email.toLowerCase();
    const providerId = profile.id!;

    // 기존 유저 조회 (Google provider_id 또는 이메일로)
    let { data: user } = await db
      .from('users')
      .select('id, email')
      .eq('provider', 'google')
      .eq('provider_id', providerId)
      .single();

    if (!user) {
      // 같은 이메일로 가입된 계정이 있는지 확인
      const { data: existingByEmail } = await db
        .from('users')
        .select('id, email, provider')
        .eq('email', email)
        .single();

      if (existingByEmail) {
        // 기존 이메일 계정을 Google 계정으로 연결
        await db.from('users').update({ provider: 'google', provider_id: providerId }).eq('id', existingByEmail.id);
        user = { id: existingByEmail.id, email: existingByEmail.email };
      } else {
        // 신규 유저 생성
        const { data: newUser, error: insertErr } = await db
          .from('users')
          .insert({
            email,
            provider: 'google',
            provider_id: providerId,
            status: 'active',
          })
          .select('id, email')
          .single();

        if (insertErr || !newUser) {
          return NextResponse.redirect(`${origin}/auth/login?error=signup_failed`);
        }

        // 기본 이메일 채널 등록
        await db.from('notification_channels').insert({
          user_id: newUser.id,
          type: 'email',
          destination: email,
          label: '기본 이메일',
          is_active: true,
        });

        user = newUser;
      }
    }

    // JWT 발급
    const token = await signToken({ sub: user.id, email: user.email });
    const cookie = sessionCookieOptions(token);

    const res = NextResponse.redirect(`${origin}/settings`);
    res.cookies.set(cookie);
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/auth/login?error=google_auth_failed`);
  }
}
