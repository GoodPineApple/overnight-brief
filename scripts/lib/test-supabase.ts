import { createClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from '../../lib/require-env';

export function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export { requireSupabaseEnv };

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
