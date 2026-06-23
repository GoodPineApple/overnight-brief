/**
 * Google News → publisher URL + 본문 추출 테스트
 *
 * 사용법:
 *   npm run test:article
 *   npm run test:article -- OpenAI 3
 */
import { chromium } from 'playwright';
import { enrichArticlesWithBody } from '../lib/article-crawler';
import { fetchGoogleNewsByKeyword } from '../lib/google-news-crawler';
import { buildFilteredQuery } from '../lib/news-sources';

async function main() {
  const keyword = process.argv[2] ?? 'OpenAI';
  const maxArticles = Number.parseInt(process.argv[3] ?? '3', 10);

  console.log('[test-article-crawl] 키워드:', keyword);
  console.log('[test-article-crawl] 필터 쿼리:', buildFilteredQuery(keyword));
  console.log('[test-article-crawl] 본문 테스트 상한:', maxArticles, '건');
  console.log('');

  const browser = await chromium.launch({ headless: true });

  try {
    const { articles, filteredCount } = await fetchGoogleNewsByKeyword(keyword, { browser });
    console.log(`[test-article-crawl] 목록 ${filteredCount}건 중 ${maxArticles}건 enrich\n`);

    const { enriched, stats } = await enrichArticlesWithBody(articles, browser, {
      maxArticles,
      onProgress: ({ index, total, title, status, reason }) => {
        console.log(
          `[${index}/${total}] ${status.toUpperCase()}${reason ? ` (${reason})` : ''}: ${title.slice(0, 70)}`,
        );
      },
    });

    console.log('');
    console.log(`[test-article-crawl] 결과: ok=${stats.ok}, skip=${stats.skip}, fail=${stats.fail}`);
    console.log('');

    for (const [i, row] of enriched.entries()) {
      console.log(`--- ${i + 1} ---`);
      console.log('제목:', row.title);
      console.log('출처:', row.source ?? '(없음)');
      console.log('Publisher URL:', row.url);
      console.log('본문 길이:', row.content.length, '자');
      console.log('본문 미리보기:', row.content.slice(0, 200).replace(/\s+/g, ' '), '...');
      console.log('');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[test-article-crawl] 실패:', err);
  process.exit(1);
});
