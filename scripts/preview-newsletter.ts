/**
 * 오늘(KST) newsletter_items → HTML/텍스트 미리보기
 *
 * Usage:
 *   npm run test:preview
 *   npm run test:preview -- --email=test@overnight-brief.local
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import '../lib/load-env';
import { composeNewsletterBrief } from '../lib/newsletter';
import { renderNewsletterHtml } from '../lib/email-template';
import { briefToPlainText } from '../lib/notifier';
import { DEFAULT_TEST_USER_EMAIL } from './fixtures/test-raw-news';
import { createTestSupabase, parseArgs, todayKstDate } from './lib/test-supabase';

async function main() {
  const { flags, email: emailArg } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`
Usage: npm run test:preview [-- --email=you@gmail.com]

  newsletter_items를 조립해 tmp/newsletter-preview.html 에 저장합니다.
`);
    return;
  }

  const supabase = createTestSupabase();
  const briefingDate = todayKstDate();
  const filterEmail = emailArg ?? process.env.TEST_USER_EMAIL ?? DEFAULT_TEST_USER_EMAIL;

  const { data: users } = await supabase.from('users').select('id, email').eq('email', filterEmail);
  const user = users?.[0];

  if (!user) {
    console.error(`[test:preview] 유저 없음: ${filterEmail}`);
    console.error('먼저 npm run test:seed 를 실행하세요.');
    process.exit(1);
  }

  const { data: items, error } = await supabase
    .from('newsletter_items')
    .select(
      `matched_keyword, summary_ko, importance_rank,
       raw_news:raw_news_id(title, url, source),
       users:user_id(keywords(keyword, created_at))`,
    )
    .eq('user_id', user.id)
    .eq('briefing_date', briefingDate);

  if (error) {
    console.error('[test:preview] 조회 실패:', error);
    process.exit(1);
  }

  if (!items?.length) {
    console.error(`[test:preview] ${briefingDate} newsletter_items 없음 (${filterEmail})`);
    console.error('  npm run process  또는  npm run test:seed:mock  를 먼저 실행하세요.');
    process.exit(1);
  }

  const keywordOrder = (
    (items[0].users as unknown as { keywords: { keyword: string; created_at: string }[] } | null)
      ?.keywords ?? []
  )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((k) => k.keyword);

  const brief = composeNewsletterBrief(
    items.map((it) => ({
      matched_keyword: it.matched_keyword,
      summary_ko: it.summary_ko,
      importance_rank: it.importance_rank,
      raw_news: it.raw_news as unknown as {
        title: string | null;
        url: string;
        source: string | null;
      } | null,
    })),
    briefingDate,
    keywordOrder,
  );

  const html = renderNewsletterHtml(brief);
  const plain = briefToPlainText(brief);

  const outDir = resolve(process.cwd(), 'tmp');
  mkdirSync(outDir, { recursive: true });
  const htmlPath = resolve(outDir, `newsletter-preview-${briefingDate}.html`);
  const textPath = resolve(outDir, `newsletter-preview-${briefingDate}.txt`);

  writeFileSync(htmlPath, html, 'utf8');
  writeFileSync(textPath, plain, 'utf8');

  console.log(`[test:preview] ${filterEmail} · ${briefingDate}`);
  console.log(`  섹션 ${brief.sections.length}개 · 아이템 ${brief.total_items}건`);
  console.log(`  HTML: ${htmlPath}`);
  console.log(`  Text: ${textPath}`);
  console.log('\n--- plain text 미리보기 ---\n');
  console.log(plain.slice(0, 1200) + (plain.length > 1200 ? '\n...(truncated)' : ''));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
