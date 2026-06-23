/**
 * 테스트용 raw_news + 유저/키워드 시드
 *
 * Usage:
 *   npm run test:seed
 *   npm run test:seed:mock          # OpenAI 없이 mock newsletter_items까지 생성
 *   npm run test:seed -- --email=you@gmail.com
 */
import '../lib/load-env';
import {
  DEFAULT_TEST_USER_EMAIL,
  TEST_KEYWORDS,
  TEST_RAW_NEWS,
  TEST_URL_PREFIX,
} from './fixtures/test-raw-news';
import {
  buildNewsletterRows,
  filterAndRankNews,
  type RawNewsCandidate,
} from '../lib/news-processor';
import { validateSummaryKo } from '../lib/newsletter';
import {
  createTestSupabase,
  parseArgs,
  todayKstDate,
} from './lib/test-supabase';

function mockSummary(title: string): string {
  return [
    `${title}에 대한 핵심 요약 첫 줄입니다.`,
    '업계와 개발자에게 미칠 영향을 설명하는 두 번째 줄입니다.',
    '앞으로 지켜볼 포인트를 정리한 세 번째 줄입니다.',
  ].join('\n');
}

async function ensureTestUser(supabase: ReturnType<typeof createTestSupabase>, email: string) {
  const { data: existing } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ email, status: 'active' })
    .select('id, email')
    .single();

  if (error) throw new Error(`테스트 유저 생성 실패: ${error.message}`);
  console.log(`[test:seed] 테스트 유저 생성: ${email}`);
  return created;
}

async function resetTestKeywords(
  supabase: ReturnType<typeof createTestSupabase>,
  userId: string,
) {
  await supabase.from('keywords').delete().eq('user_id', userId);

  const { error } = await supabase.from('keywords').insert(
    TEST_KEYWORDS.map((k) => ({
      user_id: userId,
      keyword: k.keyword,
      news_count: k.news_count,
    })),
  );

  if (error) throw new Error(`키워드 시드 실패: ${error.message}`);
}

async function ensureEmailChannel(
  supabase: ReturnType<typeof createTestSupabase>,
  userId: string,
  email: string,
) {
  const { data: channels } = await supabase
    .from('notification_channels')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'email')
    .eq('destination', email);

  if (channels?.length) return;

  const { error } = await supabase.from('notification_channels').insert({
    user_id: userId,
    type: 'email',
    destination: email,
    label: '테스트',
    is_active: true,
  });

  if (error) console.warn(`[test:seed] 이메일 채널 생성 스킵: ${error.message}`);
}

async function seedRawNews(supabase: ReturnType<typeof createTestSupabase>) {
  const now = new Date().toISOString();
  const rows = TEST_RAW_NEWS.map((a) => ({
    source: a.source,
    title: a.title,
    url: a.url,
    content: a.content,
    published_at: now,
    collected_at: now,
  }));

  const { error } = await supabase.from('raw_news').upsert(rows, {
    onConflict: 'url',
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`raw_news 시드 실패: ${error.message}`);

  const { data } = await supabase.from('raw_news').select('id, title, url, content, source, published_at').like('url', `${TEST_URL_PREFIX}%`);

  return (data ?? []) as RawNewsCandidate[];
}

async function seedMockNewsletterItems(
  supabase: ReturnType<typeof createTestSupabase>,
  userId: string,
  briefingDate: string,
  candidates: RawNewsCandidate[],
) {
  const usedNewsIds = new Set<string>();

  await supabase
    .from('newsletter_items')
    .delete()
    .eq('user_id', userId)
    .eq('briefing_date', briefingDate);

  for (const kw of TEST_KEYWORDS) {
    const matched = filterAndRankNews(candidates, kw.keyword, kw.news_count, usedNewsIds);
    if (!matched.length) continue;

    const summaries = matched.map((article, index) => ({
      raw_index: index,
      summary_ko: mockSummary(article.title),
      importance_rank: index + 1,
    }));

    for (const s of summaries) {
      if (!validateSummaryKo(s.summary_ko)) {
        throw new Error('mock summary 형식 오류');
      }
    }

    const items = buildNewsletterRows(userId, kw.keyword, matched, summaries, briefingDate);
    for (const item of items) usedNewsIds.add(item.raw_news_id);

    if (items.length) {
      const { error } = await supabase.from('newsletter_items').insert(items);
      if (error) throw new Error(`mock newsletter_items 실패: ${error.message}`);
    }
  }
}

async function main() {
  const { flags, email: emailArg } = parseArgs(process.argv.slice(2));

  if (flags.has('help')) {
    console.log(`
Usage: npm run test:seed [-- --mock-items] [--email=you@gmail.com]

  --mock-items   OpenAI 없이 mock summary로 newsletter_items까지 생성
  --email=       테스트 유저 이메일 (기본: ${DEFAULT_TEST_USER_EMAIL})
`);
    return;
  }

  const supabase = createTestSupabase();
  const email = emailArg ?? process.env.TEST_USER_EMAIL ?? DEFAULT_TEST_USER_EMAIL;
  const briefingDate = todayKstDate();

  console.log(`[test:seed] 브리핑 날짜: ${briefingDate}`);
  console.log(`[test:seed] 테스트 유저: ${email}`);

  const user = await ensureTestUser(supabase, email);
  await resetTestKeywords(supabase, user.id);
  await ensureEmailChannel(supabase, user.id, email);

  const candidates = await seedRawNews(supabase);
  console.log(`[test:seed] raw_news ${candidates.length}건 upsert (prefix: ${TEST_URL_PREFIX})`);
  console.log(`[test:seed] 키워드: ${TEST_KEYWORDS.map((k) => k.keyword).join(', ')}`);

  if (flags.has('mock-items')) {
    await seedMockNewsletterItems(supabase, user.id, briefingDate, candidates);
    console.log(`[test:seed] mock newsletter_items 생성 완료 (${briefingDate})`);
    console.log('\n다음: npm run test:preview');
  } else {
    console.log('\n다음:');
    console.log('  npm run process          # OPENAI_API_KEY 필요 — GPT 요약');
    console.log('  npm run test:preview     # 가공 결과 HTML 미리보기');
    console.log('\nOpenAI 없이 미리보기만: npm run test:seed:mock && npm run test:preview');
  }

  console.log(`\n어드민 큐: http://localhost:3000/admin/queue (admin_token 쿠키 필요)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
