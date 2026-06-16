import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { oauthStateCookieOptions } from '@/lib/auth';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
  );
}

export async function GET() {
  const oauth2Client = getOAuth2Client();
  const state = randomUUID();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(oauthStateCookieOptions(state));
  return res;
}
