// 새벽 4시 KST 실행 — 유저 키워드로 필터링 → GPT 요약 → newsletter_items 저장
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import {
  buildNewsletterRows,
  filterAndRankNews,
  type RawNewsCandidate,
} from '../lib/news-processor';

function requireOpenAiKey(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error(
      '[process-ai] OPENAI_API_KEY가 설정되지 않았습니다. .env.local 또는 GitHub Actions secret을 확인하세요.',
    );
    process.exit(1);
  }
}

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

async function main() {
  requireOpenAiKey();
  const { summarizeArticles } = await import('../lib/openai');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const briefingDate = todayKstDate();
  console.log(`[process-ai] 브리핑 날짜: ${briefingDate}`);

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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: news, error: newsError } = await supabase
    .from('raw_news')
    .select('id, title, url, content, source, published_at')
    .gte('collected_at', cutoff);

  if (newsError) {
    console.error('[process-ai] raw_news 로드 실패:', newsError);
    process.exit(1);
  }

  if (!news?.length) {
    console.log('[process-ai] 최근 24시간 수집 뉴스 없음. 종료.');
    return;
  }

  const candidates: RawNewsCandidate[] = news.map((n) => ({
    id: n.id,
    title: n.title ?? '',
    content: n.content ?? '',
    url: n.url,
    source: n.source,
    published_at: n.published_at,
  }));

  console.log(`[process-ai] 활성 유저 ${users.length}명, 후보 뉴스 ${candidates.length}건`);

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

    const usedNewsIds = new Set<string>();

    try {
      const { error: deleteError } = await supabase
        .from('newsletter_items')
        .delete()
        .eq('user_id', user.id)
        .eq('briefing_date', briefingDate);

      if (deleteError) {
        console.error(`[process-ai] 기존 아이템 삭제 실패 (${user.email}):`, deleteError);
        continue;
      }

      for (const kw of keywords) {
        const limit = Math.max(1, Math.min(20, kw.news_count ?? 10));
        const matched = filterAndRankNews(candidates, kw.keyword, limit, usedNewsIds);

        if (!matched.length) {
          console.log(`[process-ai] user=${user.email} keyword=${kw.keyword} 매칭 0건`);
          continue;
        }

        console.log(
          `[process-ai] user=${user.email} keyword=${kw.keyword} 후보=${matched.length}건`,
        );

        try {
          const summaries = await summarizeArticles({
            keyword: kw.keyword,
            articles: matched.map((c) => ({
              title: c.title,
              url: c.url,
              content: c.content,
            })),
          });

          const items = buildNewsletterRows(user.id, kw.keyword, matched, summaries, briefingDate);

          if (!items.length) {
            console.log(`[process-ai]   → GPT 유효 결과 0건 (${kw.keyword})`);
            continue;
          }

          for (const item of items) usedNewsIds.add(item.raw_news_id);

          const { error: insertError } = await supabase.from('newsletter_items').insert(items);
          if (insertError) {
            console.error(`[process-ai] insert 실패 (${user.email}/${kw.keyword}):`, insertError);
          } else {
            console.log(`[process-ai]   → ${items.length}건 저장`);
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
