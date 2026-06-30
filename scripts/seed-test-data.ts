/**
 * 테스트용 raw_news + keyword_raw_news + 유저/키워드 시드
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
  sliceCollectedNews,
  type RawNewsCandidate,
} from '../lib/news-processor';
import { validateSummaryKo } from '../lib/newsletter';
import { todayKstDate } from '../lib/kst-date';
import { createTestSupabase, parseArgs } from './lib/test-supabase';

function mockSummary(title: string): string {
  return [
    `${title}에 대한 핵심 요약 첫 줄입니다.`,
    '업계와 개발자에게 미칠 영향을 설명하는 두 번째 줄입니다.',
    '앞으로 지켜볼 포인트를 정리한 세 번째 줄입니다.',
  ].join('\n');
}

function mockInsight(keyword: string): string {
  return [
    `${keyword} 키워드 수집 뉴스에서 드러난 첫 번째 종합 인사이트입니다.`,
    '여러 기사를 관통하는 두 번째 트렌드 요약입니다.',
    '한국 IT 종사자가 주목할 세 번째 시사점입니다.',
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
  return created;
}

async function resetTestKeywords(supabase: ReturnType<typeof createTestSupabase>, userId: string) {
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

async function seedRawNewsAndKeywordLinks(
  supabase: ReturnType<typeof createTestSupabase>,
  collectionDate: string,
): Promise<Map<string, RawNewsCandidate[]>> {
  const now = new Date().toISOString();
  const rows = TEST_RAW_NEWS.map((a) => ({
    source: a.source,
    title: a.title,
    url: a.url,
    content: a.content,
    published_at: now,
    collected_at: now,
  }));

  const { error } = await supabase.from('raw_news').upsert(rows, { onConflict: 'url' });
  if (error) throw new Error(`raw_news 시드 실패: ${error.message}`);

  const { data: saved } = await supabase
    .from('raw_news')
    .select('id, title, url, content, source, published_at')
    .like('url', `${TEST_URL_PREFIX}%`);

  const byUrl = new Map((saved ?? []).map((r) => [r.url, r as RawNewsCandidate]));
  const byKeyword = new Map<string, RawNewsCandidate[]>();

  for (const kw of TEST_KEYWORDS) {
    const matched = TEST_RAW_NEWS.filter((a) => a.matchKeywords.includes(kw.keyword))
      .slice(0, kw.news_count)
      .map((a) => byUrl.get(a.url))
      .filter(Boolean) as RawNewsCandidate[];

    const links = matched.map((article, index) => ({
      keyword: kw.keyword,
      raw_news_id: article.id,
      collection_date: collectionDate,
      rank_in_batch: index + 1,
    }));

    if (links.length) {
      await supabase.from('keyword_raw_news').upsert(links, {
        onConflict: 'keyword,raw_news_id,collection_date',
      });
    }

    byKeyword.set(
      kw.keyword,
      matched.map((m, i) => ({ ...m, rank_in_batch: i + 1 })),
    );
  }

  return byKeyword;
}

async function seedMockNewsletter(
  supabase: ReturnType<typeof createTestSupabase>,
  userId: string,
  briefingDate: string,
  collectedByKeyword: Map<string, RawNewsCandidate[]>,
) {
  await supabase.from('newsletter_items').delete().eq('user_id', userId).eq('briefing_date', briefingDate);
  await supabase.from('newsletter_sections').delete().eq('user_id', userId).eq('briefing_date', briefingDate);

  for (const kw of TEST_KEYWORDS) {
    const pool = collectedByKeyword.get(kw.keyword) ?? [];
    const articles = sliceCollectedNews(pool, kw.news_count);
    if (!articles.length) continue;

    const insight = mockInsight(kw.keyword);
    if (!validateSummaryKo(insight)) throw new Error('mock insight 형식 오류');

    await supabase.from('newsletter_sections').insert({
      user_id: userId,
      matched_keyword: kw.keyword,
      insight_ko: insight,
      briefing_date: briefingDate,
    });

    const summaries = articles.map((article, index) => ({
      raw_index: index,
      summary_ko: mockSummary(article.title),
      importance_rank: index + 1,
    }));

    const items = buildNewsletterRows(userId, kw.keyword, articles, summaries, briefingDate);
    if (items.length) {
      const { error } = await supabase.from('newsletter_items').insert(items);
      if (error) throw new Error(`mock newsletter_items 실패: ${error.message}`);
    }
  }
}

async function ensureEmailChannel(supabase: ReturnType<typeof createTestSupabase>, userId: string, email: string) {
  const { data: existing } = await supabase
    .from('notification_channels')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'email')
    .eq('destination', email)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('notification_channels').insert({
    user_id: userId,
    type: 'email',
    destination: email,
    label: '기본 이메일',
    is_active: true,
  });
  if (error) throw new Error(`notification_channels 시드 실패: ${error.message}`);
}

async function main() {
  const { flags, email: emailArg } = parseArgs(process.argv.slice(2));
  const supabase = createTestSupabase();
  const email = emailArg ?? process.env.TEST_USER_EMAIL ?? DEFAULT_TEST_USER_EMAIL;
  const briefingDate = todayKstDate();

  const user = await ensureTestUser(supabase, email);
  await resetTestKeywords(supabase, user.id);
  await ensureEmailChannel(supabase, user.id, email);

  const collectedByKeyword = await seedRawNewsAndKeywordLinks(supabase, briefingDate);

  const totalLinks = [...collectedByKeyword.values()].reduce((s, a) => s + a.length, 0);
  console.log(`[test:seed] keyword_raw_news ${totalLinks}건 (${briefingDate})`);

  if (flags.has('mock-items')) {
    await seedMockNewsletter(supabase, user.id, briefingDate, collectedByKeyword);
    console.log('[test:seed] mock newsletter_sections + items 생성');
  } else {
    console.log('다음: npm run process');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
