// 새벽 4시 KST — 키워드별 수집 뉴스 → GPT 인사이트+기사별 3줄 요약 → newsletter 저장
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import { todayKstDate } from '../lib/kst-date';
import {
  buildNewsletterRows,
  sliceCollectedNews,
  type RawNewsCandidate,
} from '../lib/news-processor';

function requireOpenAiKey(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error(
      '[process-ai] OPENAI_API_KEY가 설정되지 않았습니다. .env 또는 GitHub Actions secret을 확인하세요.',
    );
    process.exit(1);
  }
}

async function loadCollectedByKeyword(
  supabase: ReturnType<typeof createClient>,
  collectionDate: string,
): Promise<Map<string, RawNewsCandidate[]>> {
  const { data, error } = await supabase
    .from('keyword_raw_news')
    .select(
      `keyword, rank_in_batch,
       raw_news:raw_news_id(id, title, url, content, source, published_at)`,
    )
    .eq('collection_date', collectionDate)
    .order('rank_in_batch', { ascending: true });

  if (error) throw error;

  type LinkRow = {
    keyword: string;
    rank_in_batch: number;
    raw_news: {
      id: string;
      title: string | null;
      url: string;
      content: string | null;
      source: string | null;
      published_at: string | null;
    } | null;
  };

  const byKeyword = new Map<string, RawNewsCandidate[]>();

  for (const row of (data ?? []) as LinkRow[]) {
    const raw = row.raw_news;

    if (!raw?.id) continue;

    const candidate: RawNewsCandidate = {
      id: raw.id,
      title: raw.title ?? '',
      content: raw.content ?? '',
      url: raw.url,
      source: raw.source,
      published_at: raw.published_at,
      rank_in_batch: row.rank_in_batch,
    };

    if (!byKeyword.has(row.keyword)) byKeyword.set(row.keyword, []);
    byKeyword.get(row.keyword)!.push(candidate);
  }

  return byKeyword;
}

async function main() {
  requireOpenAiKey();
  const { summarizeKeywordNewsletter } = await import('../lib/openai');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const briefingDate = todayKstDate();
  console.log(`[process-ai] 브리핑 날짜: ${briefingDate}`);

  const collectedByKeyword = await loadCollectedByKeyword(supabase, briefingDate);

  if (!collectedByKeyword.size) {
    console.log(
      `[process-ai] ${briefingDate} keyword_raw_news 없음. collect 먼저 실행하세요.`,
    );
    return;
  }

  const totalCollected = [...collectedByKeyword.values()].reduce((s, a) => s + a.length, 0);
  console.log(
    `[process-ai] 수집 키워드 ${collectedByKeyword.size}개, 고유 수집 매핑 ${totalCollected}건`,
  );

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, keywords(id, keyword, news_count, created_at)')
    .eq('status', 'active');

  if (usersError) {
    console.error('[process-ai] 유저 로드 실패:', usersError);
    process.exit(1);
  }

  if (!users?.length) {
    console.log('[process-ai] 활성 유저 없음. 종료.');
    return;
  }

  for (const user of users) {
    const keywords = (user.keywords ?? []) as {
      id: string;
      keyword: string;
      news_count: number;
      created_at: string;
    }[];
    keywords.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    if (!keywords.length) continue;

    try {
      await supabase.from('newsletter_items').delete().eq('user_id', user.id).eq('briefing_date', briefingDate);
      await supabase.from('newsletter_sections').delete().eq('user_id', user.id).eq('briefing_date', briefingDate);

      for (const kw of keywords) {
        const pool = collectedByKeyword.get(kw.keyword) ?? [];
        const articles = sliceCollectedNews(pool, kw.news_count);

        if (!articles.length) {
          console.log(
            `[process-ai] user=${user.email} keyword="${kw.keyword}" 수집 0건 (news_count=${kw.news_count})`,
          );
          continue;
        }

        console.log(
          `[process-ai] user=${user.email} keyword="${kw.keyword}" 수집 ${articles.length}건 → GPT`,
        );

        try {
          const result = await summarizeKeywordNewsletter({
            keyword: kw.keyword,
            articles: articles.map((c) => ({
              title: c.title,
              url: c.url,
              content: c.content,
            })),
          });

          const { error: sectionError } = await supabase.from('newsletter_sections').insert({
            user_id: user.id,
            matched_keyword: kw.keyword,
            insight_ko: result.insight_ko,
            briefing_date: briefingDate,
          });

          if (sectionError) {
            console.error(`[process-ai] section insert 실패 (${user.email}/${kw.keyword}):`, sectionError);
            continue;
          }

          const items = buildNewsletterRows(
            user.id,
            kw.keyword,
            articles,
            result.items,
            briefingDate,
          );

          if (items.length) {
            const { error: insertError } = await supabase.from('newsletter_items').insert(items);
            if (insertError) {
              console.error(`[process-ai] items insert 실패 (${user.email}/${kw.keyword}):`, insertError);
            } else {
              console.log(`[process-ai]   → 인사이트 1 + 기사 ${items.length}건 저장`);
            }
          }
        } catch (err) {
          console.error(`[process-ai] GPT 실패 (${user.email}/${kw.keyword}):`, err);
        }
      }
    } catch (err) {
      console.error(`[process-ai] 유저 처리 실패 (${user.email}):`, err);
    }
  }

  console.log('[process-ai] 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
