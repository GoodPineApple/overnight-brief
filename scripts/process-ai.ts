// 새벽 4시 KST 실행 — 유저 키워드로 필터링 → GPT 요약 → newsletter_items 저장
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { summarizeArticles } from '../lib/openai';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function matchesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const briefingDate = todayKstDate();
  console.log(`[process-ai] 브리핑 날짜: ${briefingDate}`);

  // 1. 활성 유저와 키워드 로드
  const { data: users } = await supabase
    .from('users')
    .select('id, email, keywords(id, keyword, news_count)')
    .eq('status', 'active');

  if (!users?.length) {
    console.log('[process-ai] 활성 유저 없음. 종료.');
    return;
  }

  // 2. 최근 24시간 raw_news 로드
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: news } = await supabase
    .from('raw_news')
    .select('id, title, url, content, source')
    .gte('collected_at', cutoff);

  if (!news?.length) {
    console.log('[process-ai] 최근 24시간 수집 뉴스 없음. 종료.');
    return;
  }
  console.log(`[process-ai] 활성 유저 ${users.length}명, 후보 뉴스 ${news.length}건`);

  // 3. 유저별 키워드별 필터링 + 요약
  for (const user of users) {
    const keywords = (user.keywords ?? []) as { id: string; keyword: string; news_count: number }[];
    if (!keywords.length) continue;

    for (const kw of keywords) {
      const matched = news.filter(
        (n) => matchesKeyword(n.title ?? '', kw.keyword) || matchesKeyword(n.content ?? '', kw.keyword),
      );
      if (!matched.length) continue;

      const limit = Math.max(1, Math.min(20, kw.news_count ?? 10));
      const candidates = matched.slice(0, limit);

      console.log(`[process-ai] user=${user.email} keyword=${kw.keyword} 후보=${candidates.length}건`);

      const summaries = await summarizeArticles({
        keyword: kw.keyword,
        articles: candidates.map((c) => ({
          title: c.title ?? '',
          url: c.url,
          content: c.content ?? '',
        })),
      });

      const items = summaries
        .filter((s) => candidates[s.raw_index])
        .map((s) => ({
          user_id: user.id,
          raw_news_id: candidates[s.raw_index].id,
          matched_keyword: kw.keyword,
          summary_ko: s.summary_ko,
          importance_rank: s.importance_rank,
          briefing_date: briefingDate,
        }));

      if (items.length) {
        const { error } = await supabase.from('newsletter_items').insert(items);
        if (error) console.error(`[process-ai] insert 실패 (${user.email}/${kw.keyword}):`, error);
        else console.log(`[process-ai]   → ${items.length}건 저장`);
      }
    }
  }

  console.log('[process-ai] 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
