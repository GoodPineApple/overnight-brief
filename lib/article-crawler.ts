import * as cheerio from 'cheerio';
import type { Browser, Page } from 'playwright';
import type { GoogleNewsArticle } from './google-news-crawler';
import { decodeGoogleNewsUrl } from './google-news-url-decoder';
import { matchTrustedSource, TRUSTED_SOURCES, type TrustedSource } from './news-sources';

export type ArticleBodyMethod = 'cheerio' | 'playwright' | 'og-description';

export type ArticleBodyResult = {
  publisherUrl: string;
  content: string;
  method: ArticleBodyMethod;
};

export type EnrichedArticle = {
  source: string | null;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
};

export type EnrichArticlesOptions = {
  userAgent?: string;
  articleDelayMs?: number;
  maxArticles?: number;
  minBodyChars?: number;
  onProgress?: (info: {
    index: number;
    total: number;
    title: string;
    status: 'ok' | 'skip' | 'fail';
    reason?: string;
  }) => void;
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MIN_BODY_CHARS = 300;
const ARTICLE_DELAY_MS = 1_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGoogleNewsHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'news.google.com';
  } catch {
    return false;
  }
}

function isTrustedPublisherUrl(url: string): boolean {
  return matchTrustedSource({ url }) !== null;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.toString();
}

/** Google /read/ URL → publisher 원문 URL */
export async function resolvePublisherUrl(
  googleReadUrl: string,
  page: Page,
  sourceName?: string | null,
  userAgent: string = DEFAULT_USER_AGENT,
): Promise<string | null> {
  const decoded = await decodeGoogleNewsUrl(googleReadUrl, { userAgent });
  if (decoded && isTrustedPublisherUrl(decoded)) {
    return normalizeUrl(decoded);
  }

  const trusted =
    matchTrustedSource({ url: googleReadUrl, sourceName }) ??
    (sourceName ? matchTrustedSource({ sourceName }) : null);
  const hintDomain = trusted?.domain;

  try {
    await page.goto(googleReadUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1_500);

    const finalUrl = page.url();
    if (!isGoogleNewsHost(finalUrl) && isTrustedPublisherUrl(finalUrl)) {
      return normalizeUrl(finalUrl);
    }

    if (hintDomain) {
      const href = await page.locator(`a[href*="${hintDomain}"]`).first().getAttribute('href');
      if (href && isTrustedPublisherUrl(href)) {
        return normalizeUrl(href);
      }
    }

    const resolved = await page.evaluate(
      ({ domains, hint }) => {
        const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
        if (ogUrl) {
          try {
            const u = new URL(ogUrl, location.href).href;
            if (domains.some((d) => u.includes(d))) return u;
          } catch {
            /* ignore */
          }
        }

        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        if (canonical) {
          try {
            const u = new URL(canonical, location.href).href;
            if (domains.some((d) => u.includes(d))) return u;
          } catch {
            /* ignore */
          }
        }

        const candidates: string[] = [];
        for (const a of Array.from(document.querySelectorAll('a[href]'))) {
          const href = (a as HTMLAnchorElement).href;
          if (!href || href.startsWith('javascript:')) continue;
          if (!domains.some((d) => href.includes(d))) continue;
          if (href.includes('news.google.com')) continue;
          candidates.push(href);
        }

        if (hint) {
          const hinted = candidates.find((u) => u.includes(hint));
          if (hinted) return hinted;
        }
        return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
      },
      { domains: TRUSTED_SOURCES.map((s) => s.domain), hint: hintDomain ?? null },
    );

    if (resolved && isTrustedPublisherUrl(resolved)) {
      return normalizeUrl(resolved);
    }

    return null;
  } catch {
    return null;
  }
}

function extractJsonLdArticleBody($: cheerio.CheerioAPI): string {
  const bodies: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        collectArticleBodies(node, bodies);
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  return bodies.join('\n\n').trim();
}

function collectArticleBodies(node: unknown, bodies: string[]): void {
  if (!node || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  const isArticle = types.some(
    (t) => typeof t === 'string' && /Article|NewsArticle|BlogPosting/i.test(t),
  );

  if (isArticle && typeof obj.articleBody === 'string' && obj.articleBody.trim()) {
    bodies.push(stripHtml(obj.articleBody));
  }

  if (Array.isArray(obj['@graph'])) {
    for (const child of obj['@graph']) collectArticleBodies(child, bodies);
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

function extractWithSelectors($: cheerio.CheerioAPI, source: TrustedSource | null): string {
  if (source?.excludeSelectors) {
    for (const sel of source.excludeSelectors) {
      $(sel).remove();
    }
  }

  const selectors = source?.bodySelectors ?? ['article p'];
  const parts: string[] = [];

  for (const sel of selectors) {
    const texts = $(sel)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 20);
    if (texts.length > 0) {
      parts.push(texts.join('\n\n'));
      break;
    }
  }

  if (parts.length > 0) return parts.join('\n\n').replace(/\s+/g, ' ').trim();

  const articleText = $('article').text().replace(/\s+/g, ' ').trim();
  return articleText;
}

function extractOgDescription($: cheerio.CheerioAPI): string {
  return (
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    ''
  );
}

function parseBodyFromHtml(
  html: string,
  publisherUrl: string,
  source: TrustedSource | null,
  minBodyChars: number,
): { content: string; method: ArticleBodyMethod } {
  const $ = cheerio.load(html);

  let content = extractWithSelectors($, source);
  if (content.length >= minBodyChars) {
    return { content, method: 'cheerio' };
  }

  const jsonLd = extractJsonLdArticleBody($);
  if (jsonLd.length >= minBodyChars) {
    return { content: jsonLd, method: 'cheerio' };
  }

  const og = extractOgDescription($);
  if (og.length >= minBodyChars) {
    return { content: og, method: 'og-description' };
  }

  if (content.length > 0) return { content, method: 'cheerio' };
  if (jsonLd.length > 0) return { content: jsonLd, method: 'cheerio' };
  if (og.length > 0) return { content: og, method: 'og-description' };

  return { content: '', method: 'cheerio' };
}

async function fetchHtml(url: string, userAgent: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.text();
}

async function extractBodyWithPlaywright(
  page: Page,
  source: TrustedSource | null,
): Promise<string> {
  const selectors = source?.bodySelectors ?? ['article p', 'main p', 'article'];

  return page.evaluate((sels) => {
    for (const sel of sels) {
      const nodes = Array.from(document.querySelectorAll(sel));
      const texts = nodes
        .map((el) => (el as HTMLElement).innerText?.trim())
        .filter((t): t is string => Boolean(t && t.length > 20));
      if (texts.length > 0) {
        return texts.join('\n\n').replace(/\s+/g, ' ').trim();
      }
    }
    const article = document.querySelector('article');
    return article?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }, selectors);
}

/** publisher URL에서 본문 추출 (Cheerio → Playwright fallback) */
export async function fetchArticleBody(
  publisherUrl: string,
  sourceName: string | null,
  options?: {
    userAgent?: string;
    page?: Page;
    minBodyChars?: number;
  },
): Promise<ArticleBodyResult> {
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const minBodyChars = options?.minBodyChars ?? MIN_BODY_CHARS;
  const trusted = matchTrustedSource({ url: publisherUrl, sourceName });

  let html: string | null = null;
  try {
    html = await fetchHtml(publisherUrl, userAgent);
  } catch {
    html = null;
  }

  let content = '';
  let method: ArticleBodyMethod = 'cheerio';

  if (html) {
    const parsed = parseBodyFromHtml(html, publisherUrl, trusted, minBodyChars);
    content = parsed.content;
    method = parsed.method;
  }

  if (content.length < minBodyChars && options?.page) {
    await options.page.goto(publisherUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await options.page.waitForTimeout(1_500);

    const domText = await extractBodyWithPlaywright(options.page, trusted);
    if (domText.length > content.length) {
      content = domText;
      method = 'playwright';
    }

    if (content.length < minBodyChars) {
      const rendered = await options.page.content();
      const retry = parseBodyFromHtml(rendered, publisherUrl, trusted, minBodyChars);
      if (retry.content.length > content.length) {
        content = retry.content;
        method = retry.method === 'og-description' ? 'og-description' : 'playwright';
      }
    }
  }

  return { publisherUrl, content, method };
}

/** Google News 목록 → publisher URL + 본문 enrich */
export async function enrichArticlesWithBody(
  articles: GoogleNewsArticle[],
  browser: Browser,
  options?: EnrichArticlesOptions,
): Promise<{ enriched: EnrichedArticle[]; stats: { ok: number; skip: number; fail: number } }> {
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const articleDelayMs = options?.articleDelayMs ?? ARTICLE_DELAY_MS;
  const minBodyChars = options?.minBodyChars ?? MIN_BODY_CHARS;
  const maxArticles = options?.maxArticles ?? articles.length;
  const slice = articles.slice(0, maxArticles);

  const context = await browser.newContext({ userAgent });
  const page = await context.newPage();

  const enriched: EnrichedArticle[] = [];
  let ok = 0;
  let skip = 0;
  let fail = 0;

  try {
    for (let i = 0; i < slice.length; i++) {
      const article = slice[i];
      const progress = {
        index: i + 1,
        total: slice.length,
        title: article.title,
        status: 'ok' as const,
        reason: undefined as string | undefined,
      };

      try {
        const publisherUrl = await resolvePublisherUrl(
          article.url,
          page,
          article.source,
          userAgent,
        );
        if (!publisherUrl || !isTrustedPublisherUrl(publisherUrl)) {
          skip++;
          progress.status = 'skip';
          progress.reason = 'publisher URL 추출 실패';
          options?.onProgress?.(progress);
          continue;
        }

        const body = await fetchArticleBody(publisherUrl, article.source, {
          userAgent,
          page,
          minBodyChars,
        });

        if (!body.content || body.content.length < minBodyChars) {
          skip++;
          progress.status = 'skip';
          progress.reason = `본문 부족 (${body.content.length}자, method=${body.method})`;
          options?.onProgress?.(progress);
          continue;
        }

        enriched.push({
          source: article.source,
          title: article.title,
          url: publisherUrl,
          content: body.content,
          published_at: article.publishedAt,
        });
        ok++;
        options?.onProgress?.(progress);
      } catch (err) {
        fail++;
        progress.status = 'fail';
        progress.reason = err instanceof Error ? err.message : String(err);
        options?.onProgress?.(progress);
      }

      if (i < slice.length - 1) {
        await sleep(articleDelayMs);
      }
    }
  } finally {
    await context.close();
  }

  return { enriched, stats: { ok, skip, fail } };
}
