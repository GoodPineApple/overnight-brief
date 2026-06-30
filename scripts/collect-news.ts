// 새벽 2시 KST 실행 — 키워드별 Google News 크롤링 + 본문 enrich → 키워드 단위 DB 저장
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { enrichArticlesWithBody } from '../lib/article-crawler';
import { fetchGoogleNewsByKeyword } from '../lib/google-news-crawler';
import { TRUSTED_SOURCES } from '../lib/news-sources';
import { todayKstDate } from '../lib/kst-date';

const KEYWORD_DELAY_MS = 2_500;

type KeywordJob = {
  keyword: string;
  news_count: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNewsCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(20, Math.trunc(n)));
}

function parseMaxArticlesOverride(): number | undefined {
  const raw = process.env.COLLECT_MAX_ARTICLES?.trim();
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  console.log('[collect-news] 화이트리스트 언론사:', TRUSTED_SOURCES.map((s) => s.name).join(', '));

  const { data: users, error: keywordsError } = await supabase
    .from('users')
    .select('id, keywords(keyword, news_count)')
    .eq('status', 'active');

  if (keywordsError) throw keywordsError;

  const keywordCountMap = new Map<string, number>();
  for (const user of users ?? []) {
    const keywords = user.keywords as { keyword: string; news_count?: number }[] | null;
    for (const kw of keywords ?? []) {
      const keyword = kw.keyword?.trim();
      if (!keyword) continue;
      const count = clampNewsCount(kw.news_count);
      keywordCountMap.set(keyword, Math.max(keywordCountMap.get(keyword) ?? 0, count));
    }
  }

  const jobs: KeywordJob[] = [...keywordCountMap.entries()]
    .map(([keyword, news_count]) => ({ keyword, news_count }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
  if (!jobs.length) {
    console.log('[collect-news] 활성 유저 키워드 없음. 종료.');
    return;
  }

  const maxArticlesOverride = parseMaxArticlesOverride();
  if (maxArticlesOverride) {
    console.log(`[collect-news] COLLECT_MAX_ARTICLES=${maxArticlesOverride} (키워드당 enrich 목표 상한)`);
  }

  const totalTarget = jobs.reduce((sum, j) => {
    const target = maxArticlesOverride
      ? Math.min(j.news_count, maxArticlesOverride)
      : j.news_count;
    return sum + target;
  }, 0);

  console.log(`[collect-news] 키워드 ${jobs.length}개, enrich 목표 합계 ${totalTarget}건:`);
  for (const job of jobs) {
    const target = maxArticlesOverride
      ? Math.min(job.news_count, maxArticlesOverride)
      : job.news_count;
    console.log(`  - "${job.keyword}" → ${target}건 (DB news_count 최대 ${job.news_count})`);
  }

  const browser = await chromium.launch({ headless: true });
  /** 이번 collect 실행에서 DB에 저장한 publisher URL (키워드 간 dedupe) */
  const savedUrls = new Set<string>();

  try {
    for (let i = 0; i < jobs.length; i++) {
      const { keyword, news_count } = jobs[i];
      const targetCount = maxArticlesOverride
        ? Math.min(news_count, maxArticlesOverride)
        : news_count;

      console.log(
        `[collect-news] [${i + 1}/${jobs.length}] 키워드="${keyword}" 목록 크롤링 (목표 ${targetCount}건)...`,
      );

      try {
        const { articles, rawCount, filteredCount, filteredQuery } = await fetchGoogleNewsByKeyword(
          keyword,
          { browser },
        );
        console.log(
          `[collect-news]   쿼리: ${filteredQuery.slice(0, 80)}${filteredQuery.length > 80 ? '...' : ''}`,
        );
        console.log(`[collect-news]   Google News 목록 ${rawCount}건 → 화이트리스트 ${filteredCount}건`);

        if (!articles.length) {
          console.log('[collect-news]   저장할 목록 없음. 다음 키워드로.');
          continue;
        }

        console.log(`[collect-news]   본문 enrich 시작 (성공 목표 ${targetCount}건)`);
        const { enriched, stats } = await enrichArticlesWithBody(articles, browser, {
          targetSuccessCount: targetCount,
          excludeUrls: savedUrls,
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
          `[collect-news]   enrich 완료: 성공 ${stats.ok}건, skip ${stats.skip}건, 중복 ${stats.duplicate}건, fail ${stats.fail}건`,
        );

        if (!enriched.length) {
          console.log('[collect-news]   DB 저장 건 없음. 다음 키워드로.');
          continue;
        }

        const { error } = await supabase.from('raw_news').upsert(enriched, {
          onConflict: 'url',
        });

        if (error) {
          console.error(`[collect-news]   DB 저장 실패 (키워드="${keyword}"):`, error);
          process.exit(1);
        }

        const urls = enriched.map((r) => r.url);
        const { data: savedRows, error: lookupError } = await supabase
          .from('raw_news')
          .select('id, url')
          .in('url', urls);

        if (lookupError) {
          console.error(`[collect-news]   raw_news ID 조회 실패:`, lookupError);
          process.exit(1);
        }

        const idByUrl = new Map((savedRows ?? []).map((r) => [r.url, r.id]));
        const collectionDate = todayKstDate();
        const keywordLinks = enriched
          .map((row, index) => {
            const rawNewsId = idByUrl.get(row.url);
            if (!rawNewsId) return null;
            return {
              keyword,
              raw_news_id: rawNewsId,
              collection_date: collectionDate,
              rank_in_batch: index + 1,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (keywordLinks.length) {
          const { error: linkError } = await supabase.from('keyword_raw_news').upsert(keywordLinks, {
            onConflict: 'keyword,raw_news_id,collection_date',
          });
          if (linkError) {
            console.error(`[collect-news]   keyword_raw_news 저장 실패:`, linkError);
            process.exit(1);
          }
        }

        for (const row of enriched) {
          savedUrls.add(row.url);
        }

        console.log(
          `[collect-news]   DB 저장 ${enriched.length}건 + keyword 매핑 ${keywordLinks.length}건 (누적 고유 ${savedUrls.size}건)`,
        );
      } catch (err) {
        console.error(`[collect-news]   키워드="${keyword}" 실패:`, err);
      }

      if (i < jobs.length - 1) {
        await sleep(KEYWORD_DELAY_MS);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[collect-news] 완료: 총 ${savedUrls.size}건 DB 저장 (고유 publisher URL)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
