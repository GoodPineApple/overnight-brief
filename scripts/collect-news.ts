// 새벽 2시 KST 실행 — NewsAPI에서 글로벌 테크 뉴스 수집 → raw_news에 저장
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type NewsApiArticle = {
  source: { id: string | null; name: string };
  title: string;
  url: string;
  content: string | null;
  description: string | null;
  publishedAt: string;
};

async function fetchTopHeadlines() {
  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('category', 'technology');
  url.searchParams.set('language', 'en');
  url.searchParams.set('pageSize', '100');

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': process.env.NEWS_API_KEY! },
  });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { articles: NewsApiArticle[] };
  return data.articles ?? [];
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log('[collect-news] NewsAPI 호출 중...');
  const articles = await fetchTopHeadlines();
  console.log(`[collect-news] 수집된 기사: ${articles.length}건`);

  const rows = articles
    .filter((a) => a.url && a.title)
    .map((a) => ({
      source: a.source.name,
      title: a.title,
      url: a.url,
      content: a.content ?? a.description ?? '',
      published_at: a.publishedAt,
    }));

  // url UNIQUE 제약으로 중복 자동 제거 (upsert)
  const { error } = await supabase.from('raw_news').upsert(rows, {
    onConflict: 'url',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[collect-news] DB 저장 실패:', error);
    process.exit(1);
  }
  console.log(`[collect-news] 완료: ${rows.length}건 저장`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
