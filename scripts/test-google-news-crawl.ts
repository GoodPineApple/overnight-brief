/**
 * Google News 화이트리스트 웹 크롤링 테스트 (Playwright)
 *
 * 사용법:
 *   npm run test:crawl
 *   npm run test:crawl -- OpenAI
 */
import { fetchGoogleNewsByKeyword } from '../lib/google-news-crawler';
import {
  TRUSTED_SOURCES,
  buildFilteredQuery,
  buildGoogleNewsSearchPageUrl,
} from '../lib/news-sources';

async function main() {
  const keyword = process.argv[2] ?? 'OpenAI';

  console.log('[test-google-news-crawl] 키워드:', keyword);
  console.log('[test-google-news-crawl] 화이트리스트:', TRUSTED_SOURCES.map((s) => s.name).join(', '));
  console.log('[test-google-news-crawl] 필터 쿼리:', buildFilteredQuery(keyword));
  console.log('[test-google-news-crawl] 검색 URL:', buildGoogleNewsSearchPageUrl(keyword));
  console.log('[test-google-news-crawl] 방식: Playwright 웹 크롤링 (RSS 미사용)');
  console.log('');

  const { articles, rawCount, filteredCount, webUrl } = await fetchGoogleNewsByKeyword(keyword);
  console.log('[test-google-news-crawl] 크롤링 대상:', webUrl);
  console.log(`[test-google-news-crawl] 수집 ${rawCount}건 → 화이트리스트 ${filteredCount}건\n`);

  const bySource = new Map<string, number>();
  for (const a of articles) {
    const key = a.source ?? '(출처 없음)';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  console.log('[test-google-news-crawl] 출처별 분포:');
  for (const [source, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}건`);
  }
  console.log('');

  articles.slice(0, 10).forEach((article, i) => {
    console.log(`--- ${i + 1} ---`);
    console.log('제목:', article.title);
    console.log('출처:', article.source ?? '(없음)');
    console.log('URL:', article.url);
    console.log('발행:', article.publishedAt ?? '(없음)');
    console.log('');
  });

  if (articles.length > 10) {
    console.log(`... 외 ${articles.length - 10}건`);
  }
}

main().catch((err) => {
  console.error('[test-google-news-crawl] 실패:', err);
  process.exit(1);
});
