// 새벽 2시 KST 실행 — 활성 유저 키워드별 Google News(화이트리스트) 크롤링 + 본문 추출 → raw_news 저장
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { enrichArticlesWithBody } from '../lib/article-crawler';
import { fetchGoogleNewsByKeyword, type GoogleNewsArticle } from '../lib/google-news-crawler';
import { TRUSTED_SOURCES } from '../lib/news-sources';

const KEYWORD_DELAY_MS = 2_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMaxArticles(): number | undefined {
  const raw = process.env.COLLECT_MAX_ARTICLES?.trim();
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function loadActiveKeywords(supabase: ReturnType<typeof createClient>) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, keywords(keyword)')
    .eq('status', 'active');

  if (error) throw error;

  const keywordSet = new Set<string>();
  for (const user of users ?? []) {
    for (const kw of (user.keywords ?? []) as { keyword: string }[]) {
      if (kw.keyword?.trim()) keywordSet.add(kw.keyword.trim());
    }
  }
  return [...keywordSet];
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log('[collect-news] 화이트리스트 언론사:', TRUSTED_SOURCES.map((s) => s.name).join(', '));

  const keywords = await loadActiveKeywords(supabase);
  if (!keywords.length) {
    console.log('[collect-news] 활성 유저 키워드 없음. 종료.');
    return;
  }
  console.log(`[collect-news] 수집 키워드 ${keywords.length}개:`, keywords.join(', '));

  const maxArticles = parseMaxArticles();
  if (maxArticles) {
    console.log(`[collect-news] COLLECT_MAX_ARTICLES=${maxArticles} (본문 enrich 상한)`);
  }

  const browser = await chromium.launch({ headless: true });
  const articleMap = new Map<string, GoogleNewsArticle>();

  try {
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      console.log(`[collect-news] [${i + 1}/${keywords.length}] 키워드="${keyword}" 목록 크롤링...`);

      try {
        const { articles, rawCount, filteredCount, filteredQuery } = await fetchGoogleNewsByKeyword(
          keyword,
          { browser },
        );
        console.log(
          `[collect-news]   쿼리: ${filteredQuery.slice(0, 80)}${filteredQuery.length > 80 ? '...' : ''}`,
        );
        console.log(`[collect-news]   수집 ${rawCount}건 → 화이트리스트 ${filteredCount}건`);

        for (const article of articles) {
          if (!articleMap.has(article.url)) {
            articleMap.set(article.url, article);
          }
        }
      } catch (err) {
        console.error(`[collect-news]   키워드="${keyword}" 실패:`, err);
      }

      if (i < keywords.length - 1) {
        await sleep(KEYWORD_DELAY_MS);
      }
    }

    const candidates = [...articleMap.values()];
    if (!candidates.length) {
      console.log('[collect-news] 저장할 기사 없음. 종료.');
      return;
    }

    console.log(`[collect-news] 본문 enrich 시작: ${candidates.length}건 후보`);
    const { enriched, stats } = await enrichArticlesWithBody(candidates, browser, {
      maxArticles,
      onProgress: ({ index, total, title, status, reason }) => {
        if (status === 'ok') {
          console.log(`[collect-news]   [${index}/${total}] OK: ${title.slice(0, 60)}`);
        } else {
          console.log(
            `[collect-news]   [${index}/${total}] ${status.toUpperCase()}: ${title.slice(0, 50)} — ${reason}`,
          );
        }
      },
    });

    console.log(
      `[collect-news] 본문 enrich 완료: 성공 ${stats.ok}건, skip ${stats.skip}건, fail ${stats.fail}건`,
    );

    const rowMap = new Map<string, (typeof enriched)[number]>();
    for (const row of enriched) {
      rowMap.set(row.url, row);
    }

    const rows = [...rowMap.values()];
    if (!rows.length) {
      console.log('[collect-news] 본문 포함 저장 가능한 기사 없음. 종료.');
      return;
    }

    const { error } = await supabase.from('raw_news').upsert(rows, {
      onConflict: 'url',
    });

    if (error) {
      console.error('[collect-news] DB 저장 실패:', error);
      process.exit(1);
    }

    console.log(`[collect-news] 완료: ${rows.length}건 저장 (publisher URL + 본문)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
