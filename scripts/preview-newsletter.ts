/**
 * 오늘(KST) newsletter → HTML/텍스트 미리보기
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import '../lib/load-env';
import { renderNewsletterHtml } from '../lib/email-template';
import { briefToPlainText } from '../lib/notifier';
import { loadNewsletterBriefForUser } from '../lib/load-newsletter-brief';
import { DEFAULT_TEST_USER_EMAIL } from './fixtures/test-raw-news';
import { createTestSupabase, parseArgs, todayKstDate } from './lib/test-supabase';

async function main() {
  const { flags, email: emailArg } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`Usage: npm run test:preview [-- --email=you@gmail.com]`);
    return;
  }

  const supabase = createTestSupabase();
  const briefingDate = todayKstDate();
  const filterEmail = emailArg ?? process.env.TEST_USER_EMAIL ?? DEFAULT_TEST_USER_EMAIL;

  const { data: userRow } = await supabase
    .from('users')
    .select('id, email, keywords(keyword, created_at)')
    .eq('email', filterEmail)
    .maybeSingle();

  if (!userRow) {
    console.error(`[test:preview] 유저 없음: ${filterEmail}`);
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
    console.error(`[test:preview] ${briefingDate} 뉴스레터 없음 (${filterEmail})`);
    console.error('  npm run collect && npm run process  또는  npm run test:seed:mock');
    process.exit(1);
  }

  const html = renderNewsletterHtml(brief);
  const plain = briefToPlainText(brief);

  const outDir = resolve(process.cwd(), 'tmp');
  mkdirSync(outDir, { recursive: true });
  const htmlPath = resolve(outDir, `newsletter-preview-${briefingDate}.html`);
  const textPath = resolve(outDir, `newsletter-preview-${briefingDate}.txt`);

  writeFileSync(htmlPath, html, 'utf8');
  writeFileSync(textPath, plain, 'utf8');

  console.log(`[test:preview] ${filterEmail} · ${briefingDate}`);
  console.log(`  섹션 ${brief.sections.length}개 · 기사 ${brief.total_items}건`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  Text: ${textPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
