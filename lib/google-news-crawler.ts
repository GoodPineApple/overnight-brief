import { chromium, type Browser, type Page } from 'playwright';
import {
  buildFilteredQuery,
  buildGoogleNewsSearchUrl,
  filterArticlesByTrustedSources,
  type GoogleNewsLocale,
} from './news-sources';

export type GoogleNewsSearchParams = {
  query: string;
  hl: string;
  gl: string;
};

export type GoogleNewsArticle = {
  title: string;
  url: string;
  source: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  description: string | null;
};

export type FetchGoogleNewsResult = {
  articles: GoogleNewsArticle[];
  webUrl: string;
  searchParams: GoogleNewsSearchParams;
  rawCount: number;
  filteredCount: number;
  filteredQuery: string;
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Google News 검색 URL에서 쿼리 파라미터 추출 */
export function parseGoogleNewsSearchUrl(url: string): GoogleNewsSearchParams {
  const parsed = new URL(url);

  const query = parsed.searchParams.get('q')?.trim();
  if (!query) {
    throw new Error('검색 URL에 q 파라미터가 없습니다.');
  }

  if (parsed.searchParams.get('tbm') && parsed.searchParams.get('tbm') !== 'nws') {
    throw new Error('tbm=nws (뉴스 탭) URL만 지원합니다.');
  }

  return {
    query,
    hl: parsed.searchParams.get('hl') ?? 'en-US',
    gl: parsed.searchParams.get('gl') ?? 'US',
  };
}

/**
 * google.com/search?tbm=nws URL → news.google.com/search 웹 URL 변환.
 * (google.com/search는 headless 환경에서 CAPTCHA에 걸리는 경우가 많음)
 */
export function buildGoogleNewsWebUrl(params: GoogleNewsSearchParams): string {
  const language = params.hl.split('-')[0] ?? 'en';
  const ceid = `${params.gl}:${language}`;

  const url = new URL('https://news.google.com/search');
  url.searchParams.set('q', params.query);
  url.searchParams.set('hl', params.hl);
  url.searchParams.set('gl', params.gl);
  url.searchParams.set('ceid', ceid);
  return url.toString();
}

function cleanSourceName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/More$/i, '').trim() || null;
}

async function scrapeArticlesFromPage(page: Page): Promise<GoogleNewsArticle[]> {
  await page.waitForSelector('a[href*="/read/"]', { timeout: 30_000 });

  return page.evaluate(() => {
    const results: Array<{
      title: string;
      url: string;
      source: string | null;
      sourceUrl: string | null;
      publishedAt: string | null;
      description: string | null;
    }> = [];
    const seen = new Set<string>();

    for (const link of Array.from(document.querySelectorAll('a[href*="/read/"]'))) {
      const anchor = link as HTMLAnchorElement;
      const title = anchor.textContent?.trim();
      if (!title || title.length < 10 || seen.has(anchor.href)) continue;
      seen.add(anchor.href);

      const card = anchor.closest('article, c-wiz, div[jslog]');
      const timeEl = card?.querySelector('time');

      let source: string | null = null;
      if (card) {
        const candidates = Array.from(card.querySelectorAll('div'))
          .map((d) => d.textContent?.trim())
          .filter((t): t is string => Boolean(t && t.length > 0 && t.length < 60));
        source =
          candidates.find(
            (t) =>
              t !== title &&
              !t.startsWith('By ') &&
              !/\d+\s+(minute|hour|day|week|month|year)s?\s+ago/i.test(t) &&
              !/^\d+\s+(hours?|days?)\s+ago$/i.test(t),
          ) ?? null;
      }

      results.push({
        title,
        url: anchor.href,
        source: source ? source.replace(/More$/i, '').trim() : null,
        sourceUrl: null,
        publishedAt: timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || null,
        description: null,
      });
    }

    return results;
  });
}

export type CrawlGoogleNewsOptions = {
  userAgent?: string;
  headless?: boolean;
  browser?: Browser;
  locale?: Partial<GoogleNewsLocale>;
  /** false면 2차 화이트리스트 필터 생략 (테스트용) */
  applyTrustedFilter?: boolean;
};

async function crawlGoogleNewsWebUrl(
  webUrl: string,
  searchParams: GoogleNewsSearchParams,
  filteredQuery: string,
  options?: CrawlGoogleNewsOptions,
): Promise<FetchGoogleNewsResult> {
  const applyTrustedFilter = options?.applyTrustedFilter ?? true;
  const ownsBrowser = !options?.browser;
  const browser =
    options?.browser ??
    (await chromium.launch({ headless: options?.headless ?? true }));

  try {
    const context = await browser.newContext({
      userAgent: options?.userAgent ?? DEFAULT_USER_AGENT,
      locale: searchParams.hl,
    });
    const page = await context.newPage();

    await page.goto(webUrl, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(2_000);

    if (page.url().includes('/sorry/')) {
      throw new Error(
        'Google CAPTCHA에 걸렸습니다. headless=false로 재시도하거나 IP/요청 빈도를 확인해주세요.',
      );
    }

    const rawArticles = (await scrapeArticlesFromPage(page)).map((a) => ({
      ...a,
      source: cleanSourceName(a.source),
    }));
    await context.close();

    const rawCount = rawArticles.length;
    const articles = applyTrustedFilter
      ? filterArticlesByTrustedSources(rawArticles)
      : rawArticles;

    if (articles.length === 0) {
      throw new Error(
        rawCount > 0
          ? '기사는 수집됐으나 화이트리스트 필터 후 0건입니다. TRUSTED_SOURCES 설정을 확인해주세요.'
          : '기사를 찾지 못했습니다. Google News 페이지 구조가 변경됐을 수 있습니다.',
      );
    }

    return {
      articles,
      webUrl,
      searchParams,
      rawCount,
      filteredCount: articles.length,
      filteredQuery,
    };
  } finally {
    if (ownsBrowser) {
      await browser.close();
    }
  }
}

/**
 * Google News 검색 URL 기준으로 기사 목록을 웹 크롤링합니다.
 * RSS는 사용하지 않습니다.
 */
export async function fetchGoogleNewsArticles(
  searchUrl: string,
  options?: CrawlGoogleNewsOptions,
): Promise<FetchGoogleNewsResult> {
  const searchParams = parseGoogleNewsSearchUrl(searchUrl);
  const webUrl = buildGoogleNewsWebUrl(searchParams);
  return crawlGoogleNewsWebUrl(webUrl, searchParams, searchParams.query, options);
}

/**
 * 키워드 + TRUSTED_SOURCES site: 필터로 Google News 웹 크롤링 (주 진입점).
 */
export async function fetchGoogleNewsByKeyword(
  keyword: string,
  options?: CrawlGoogleNewsOptions,
): Promise<FetchGoogleNewsResult> {
  const locale = { hl: 'en-US', gl: 'US', ...options?.locale };
  const filteredQuery = buildFilteredQuery(keyword);
  const webUrl = buildGoogleNewsSearchUrl(keyword, locale);
  const searchParams: GoogleNewsSearchParams = {
    query: filteredQuery,
    hl: locale.hl,
    gl: locale.gl,
  };

  return crawlGoogleNewsWebUrl(webUrl, searchParams, filteredQuery, options);
}
