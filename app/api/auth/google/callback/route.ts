import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import {
  signToken,
  sessionCookieOptions,
  getOAuthStateFromRequest,
  deleteOAuthStateCookieOptions,
} from '@/lib/auth';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
  );
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

type AuthUser = { id: string; email: string; status?: string };

function redirectWithError(error: string) {
  return NextResponse.redirect(`${BASE_URL}/auth/login?error=${error}`);
}

function clearOAuthState(res: NextResponse) {
  res.cookies.set(deleteOAuthStateCookieOptions());
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const state = searchParams.get('state');
  const savedState = getOAuthStateFromRequest(req);

  if (errorParam || !code) {
    return clearOAuthState(redirectWithError('google_auth_failed'));
  }

  if (!state || !savedState || state !== savedState) {
    return clearOAuthState(redirectWithError('invalid_state'));
  }

  const oauth2Client = getOAuth2Client();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return clearOAuthState(redirectWithError('no_email'));
    }

    const db = createSupabaseAdminClient();
    const email = profile.email.toLowerCase();
    const providerId: string = (profile.sub ?? profile.id ?? '') as string;

    let user: AuthUser | null = null;

    if (providerId) {
      const { data, error: lookupErr } = await db
        .from('users')
        .select('id, email, status')
        .eq('provider', 'google')
        .eq('provider_id', providerId)
        .maybeSingle();

      if (lookupErr) {
        console.error('[google/callback] provider_id lookup error:', lookupErr);
      }
      user = data;
    }

    if (!user) {
      const { data: existingByEmail, error: emailLookupErr } = await db
        .from('users')
        .select('id, email, status')
        .eq('email', email)
        .maybeSingle();

      if (emailLookupErr) {
        console.error('[google/callback] email lookup error:', emailLookupErr);
      }

      if (existingByEmail) {
        const { error: updateErr } = await db
          .from('users')
          .update({ provider: 'google', provider_id: providerId || null })
          .eq('id', existingByEmail.id);

        if (updateErr) {
          console.error('[google/callback] provider update error:', updateErr);
          return clearOAuthState(redirectWithError('signup_failed'));
        }

        user = existingByEmail;
      } else {
        const { data: newUser, error: insertErr } = await db
          .from('users')
          .insert({
            email,
            provider: 'google',
            provider_id: providerId || null,
            status: 'active',
          })
          .select('id, email, status')
          .single();

        if (insertErr || !newUser) {
          console.error('[google/callback] insert error:', JSON.stringify(insertErr));
          return clearOAuthState(redirectWithError('signup_failed'));
        }

        const { error: channelErr } = await db.from('notification_channels').insert({
          user_id: newUser.id,
          type: 'email',
          destination: email,
          label: '기본 이메일',
          is_active: true,
        });

        if (channelErr) {
          console.error('[google/callback] notification_channels insert error:', channelErr);
        }

        user = newUser;
      }
    }

    if (user.status === 'inactive') {
      return clearOAuthState(redirectWithError('account_inactive'));
    }

    const token = await signToken({ sub: user.id, email: user.email });
    const cookie = sessionCookieOptions(token);

    const res = NextResponse.redirect(`${BASE_URL}/settings`);
    res.cookies.set(cookie);
    res.cookies.set(deleteOAuthStateCookieOptions());
    return res;
  } catch (err) {
    console.error('[google/callback] unexpected error:', err);
    return clearOAuthState(redirectWithError('google_auth_failed'));
  }
}
