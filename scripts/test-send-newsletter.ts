/**
 * DB에 저장된 뉴스레터 → 지정 이메일로 실제 발송 (로컬 검증용)
 *
 * Usage:
 *   npm run test:send -- --to=you@gmail.com
 *   npm run test:send -- --email=test@overnight-brief.local --to=you@gmail.com
 *   npm run test:send -- --to=you@gmail.com --dry-run
 */
import '../lib/load-env';
import { requireGmailEnv, requireSupabaseEnv } from '../lib/require-env';
import { loadNewsletterBriefForUser } from '../lib/load-newsletter-brief';
import { newsletterSubject, sendBriefToEmail } from '../lib/send-newsletter';
import { renderNewsletterHtml } from '../lib/email-template';
import { DEFAULT_TEST_USER_EMAIL } from './fixtures/test-raw-news';
import { createTestSupabase, todayKstDate } from './lib/test-supabase';

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  let email: string | undefined;
  let to: string | undefined;
  let date: string | undefined;

  for (const arg of argv) {
    if (arg === '--dry-run') flags.add('dry-run');
    else if (arg === '--help' || arg === '-h') flags.add('help');
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length);
    else if (arg.startsWith('--to=')) to = arg.slice('--to='.length);
    else if (arg.startsWith('--date=')) date = arg.slice('--date='.length);
  }

  return { flags, email, to, date };
}

async function main() {
  const { flags, email: emailArg, to: toArg, date: dateArg } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`Usage:
  npm run test:send -- --to=you@gmail.com
  npm run test:send -- --email=test@overnight-brief.local --to=you@gmail.com
  npm run test:send -- --to=you@gmail.com --date=2026-06-30
  npm run test:send -- --to=you@gmail.com --dry-run`);
    return;
  }

  requireSupabaseEnv();
  if (!flags.has('dry-run')) requireGmailEnv();

  const filterEmail = emailArg ?? process.env.TEST_USER_EMAIL ?? DEFAULT_TEST_USER_EMAIL;
  const destination = toArg ?? filterEmail;
  const briefingDate = dateArg ?? todayKstDate();

  const supabase = createTestSupabase();

  const { data: userRow } = await supabase
    .from('users')
    .select('id, email, keywords(keyword, created_at)')
    .eq('email', filterEmail)
    .maybeSingle();

  if (!userRow) {
    console.error(`[test:send] 유저 없음: ${filterEmail}`);
    console.error('  npm run test:seed:mock -- --email=' + filterEmail);
    process.exit(1);
  }

  const keywordOrder = (
    (userRow.keywords ?? []) as { keyword: string; created_at: string }[]
  )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((k) => k.keyword);

  const brief = await loadNewsletterBriefForUser(
    supabase,
    userRow.id,
    briefingDate,
    keywordOrder,
  );

  if (!brief) {
    console.error(`[test:send] ${briefingDate} 뉴스레터 없음 (${filterEmail})`);
    console.error('  npm run test:seed:mock  또는  npm run collect && npm run process');
    process.exit(1);
  }

  const subject = newsletterSubject(briefingDate);

  console.log(`[test:send] 유저: ${filterEmail}`);
  console.log(`  날짜: ${briefingDate}`);
  console.log(`  섹션 ${brief.sections.length}개 · 기사 ${brief.total_items}건`);
  console.log(`  수신: ${destination}`);
  console.log(`  제목: ${subject}`);

  if (flags.has('dry-run')) {
    const html = renderNewsletterHtml(brief);
    console.log(`  HTML 크기: ${html.length} bytes (발송 생략)`);
    return;
  }

  const { data: channel } = await supabase
    .from('notification_channels')
    .select('id')
    .eq('user_id', userRow.id)
    .eq('type', 'email')
    .eq('destination', destination)
    .eq('is_active', true)
    .maybeSingle();

  await sendBriefToEmail(supabase, userRow.id, destination, brief, channel?.id ?? null);
  console.log(`[test:send] ✅ 발송 완료 → ${destination}`);
}

main().catch((err) => {
  console.error('[test:send] ❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
