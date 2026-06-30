export function requireSupabaseEnv(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.error('[env] NEXT_PUBLIC_SUPABASE_URL가 설정되지 않았습니다.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('[env] SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }
}

export function requireGmailEnv(): void {
  const missing: string[] = [];
  for (const key of [
    'GMAIL_USER',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
  ] as const) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (missing.length) {
    console.error(`[env] Gmail OAuth 설정 누락: ${missing.join(', ')}`);
    process.exit(1);
  }
}
