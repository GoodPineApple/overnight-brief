export type TrustedSource = {
  id: string;
  name: string;
  domain: string;
  rssUrl?: string;
  aliases?: string[];
  bodySelectors?: string[];
  excludeSelectors?: string[];
};

export const TRUSTED_SOURCES: TrustedSource[] = [
  {
    id: 'reuters',
    name: 'Reuters',
    domain: 'reuters.com',
    rssUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best',
    aliases: ['Reuters', 'reuters.com'],
    bodySelectors: ['[data-testid="paragraph"]', '[data-testid="Body"]', '.article-body__content__17Yit p', 'article p'],
    excludeSelectors: ['.related-content', '.newsletter-signup'],
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    domain: 'techcrunch.com',
    rssUrl: 'https://techcrunch.com/feed/',
    aliases: ['TechCrunch', 'techcrunch.com'],
    bodySelectors: ['.article-content p', '.wp-block-post-content p', 'article p'],
    excludeSelectors: ['.related-articles', '.newsletter-signup'],
  },
  {
    id: 'theverge',
    name: 'The Verge',
    domain: 'theverge.com',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    aliases: ['The Verge', 'theverge.com'],
    bodySelectors: [
      '.duet--article--article-body-component p',
      '.c-entry-content p',
      'article p',
    ],
    excludeSelectors: ['.c-related-links'],
  },
  {
    id: 'arstechnica',
    name: 'Ars Technica',
    domain: 'arstechnica.com',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    aliases: ['Ars Technica', 'arstechnica.com'],
    bodySelectors: ['.article-content p', '.page-content p', 'article p'],
    excludeSelectors: ['.related-stories'],
  },
  {
    id: 'wired',
    name: 'WIRED',
    domain: 'wired.com',
    rssUrl: 'https://www.wired.com/feed/rss',
    aliases: ['WIRED', 'Wired', 'wired.com'],
    bodySelectors: ['.body__inner-container p', '.paywall__content p', 'article p'],
    excludeSelectors: ['.related-coverage'],
  },
  {
    id: 'axios',
    name: 'Axios',
    domain: 'axios.com',
    rssUrl: 'https://api.axios.com/feed/',
    aliases: ['Axios', 'axios.com'],
    bodySelectors: ['.story-content p', '[data-testid="story-content"] p', 'article p'],
    excludeSelectors: ['.related-stories'],
  },
  {
    id: 'mit-tr',
    name: 'MIT Technology Review',
    domain: 'technologyreview.com',
    rssUrl: 'https://www.technologyreview.com/feed/',
    aliases: ['MIT Technology Review', 'technologyreview.com'],
    bodySelectors: ['.c-article__body p', '.content-truncation p', 'article p'],
    excludeSelectors: ['.related-content'],
  },
  {
    id: 'engadget',
    name: 'Engadget',
    domain: 'engadget.com',
    rssUrl: 'https://www.engadget.com/rss.xml',
    aliases: ['Engadget', 'engadget.com'],
    bodySelectors: ['.article-text p', '.c-article__content p', 'article p'],
    excludeSelectors: ['.related-articles'],
  },
  {
    id: 'venturebeat',
    name: 'VentureBeat',
    domain: 'venturebeat.com',
    rssUrl: 'https://venturebeat.com/feed/',
    aliases: ['VentureBeat', 'venturebeat.com'],
    bodySelectors: ['.article-content p', '.entry-content p', 'article p'],
    excludeSelectors: ['.related-posts'],
  },
  {
    id: 'cnbc',
    name: 'CNBC',
    domain: 'cnbc.com',
    rssUrl: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',
    aliases: ['CNBC', 'cnbc.com'],
    bodySelectors: ['.ArticleBody-articleBody p', '.group p', 'article p'],
    excludeSelectors: ['.RelatedContent'],
  },
];

export type GoogleNewsLocale = {
  hl: string;
  gl: string;
};

const DEFAULT_LOCALE: GoogleNewsLocale = { hl: 'en-US', gl: 'US' };

/** 키워드 + 10개 언론사 site: 필터 쿼리 생성 */
export function buildFilteredQuery(keyword: string): string {
  const sites = TRUSTED_SOURCES.map((s) => `site:${s.domain}`).join(' OR ');
  return `${keyword.trim()} (${sites})`;
}

/** news.google.com/search URL 생성 */
export function buildGoogleNewsSearchUrl(
  keyword: string,
  opts?: Partial<GoogleNewsLocale>,
): string {
  const { hl, gl } = { ...DEFAULT_LOCALE, ...opts };
  const language = hl.split('-')[0] ?? 'en';
  const ceid = `${gl}:${language}`;
  const query = buildFilteredQuery(keyword);

  const url = new URL('https://news.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);
  url.searchParams.set('ceid', ceid);
  return url.toString();
}

/** google.com/search?tbm=nws 형식 URL (테스트/문서용) */
export function buildGoogleNewsSearchPageUrl(
  keyword: string,
  opts?: Partial<GoogleNewsLocale>,
): string {
  const { hl, gl } = { ...DEFAULT_LOCALE, ...opts };
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', buildFilteredQuery(keyword));
  url.searchParams.set('tbm', 'nws');
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);
  return url.toString();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** URL 또는 source명으로 TRUSTED_SOURCES 매칭 */
export function matchTrustedSource(input: {
  url?: string | null;
  sourceName?: string | null;
}): TrustedSource | null {
  const urlNorm = input.url ? normalize(input.url) : '';
  const sourceNorm = input.sourceName ? normalize(input.sourceName) : '';

  for (const s of TRUSTED_SOURCES) {
    const names = [s.name, ...(s.aliases ?? []), s.domain].map(normalize);
    if (urlNorm && names.some((n) => urlNorm.includes(n))) return s;
    if (sourceNorm && names.some((n) => sourceNorm.includes(n) || n.includes(sourceNorm))) {
      return s;
    }
  }
  return null;
}

/** 2차 화이트리스트 필터 — source명 또는 URL 도메인 기준 */
export function isTrustedArticle(article: {
  source?: string | null;
  url: string;
}): boolean {
  return matchTrustedSource({ url: article.url, sourceName: article.source }) !== null;
}

export function filterArticlesByTrustedSources<T extends { source?: string | null; url: string }>(
  articles: T[],
): T[] {
  return articles.filter(isTrustedArticle);
}
