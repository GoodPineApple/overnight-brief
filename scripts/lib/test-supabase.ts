import { createClient } from '@supabase/supabase-js';

export function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function requireSupabaseEnv(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    console.error('[test] NEXT_PUBLIC_SUPABASE_URL가 설정되지 않았습니다.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('[test] SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }
}

export function createTestSupabase() {
  requireSupabaseEnv();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  let email: string | undefined;

  for (const arg of argv) {
    if (arg === '--mock-items') flags.add('mock-items');
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length);
    else if (arg === '--help' || arg === '-h') flags.add('help');
  }

  return { flags, email };
}
