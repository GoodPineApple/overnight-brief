import * as cheerio from 'cheerio';

export type NewsRssItem = {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  description: string | null;
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, ' ').trim();
}

/** 개별 뉴스 사이트 RSS/Atom XML 파싱 (Google News RSS는 사용 금지) */
export function parseNewsRssFeed(xml: string): NewsRssItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: NewsRssItem[] = [];

  $('item, entry').each((_, el) => {
    const item = $(el);
    const title = item.find('title').first().text().trim();
    const link =
      item.find('link').first().attr('href')?.trim() ||
      item.find('link').first().text().trim() ||
      item.find('id').first().text().trim();

    if (!title || !link) return;

    items.push({
      title,
      url: link,
      source: item.find('source').first().text().trim() || null,
      publishedAt:
        item.find('pubDate').first().text().trim() ||
        item.find('published').first().text().trim() ||
        item.find('updated').first().text().trim() ||
        null,
      description:
        stripHtml(item.find('description').first().text()) ||
        stripHtml(item.find('summary').first().text()) ||
        stripHtml(item.find('content\\:encoded').first().text()) ||
        null,
    });
  });

  return items;
}

/** 개별 뉴스 사이트 RSS URL에서 기사 메타데이터 수집 */
export async function fetchNewsRssFeed(
  feedUrl: string,
  options?: { userAgent?: string },
): Promise<NewsRssItem[]> {
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': options?.userAgent ?? DEFAULT_USER_AGENT,
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
  });

  if (!res.ok) {
    throw new Error(`RSS fetch failed ${res.status}: ${feedUrl}`);
  }

  return parseNewsRssFeed(await res.text());
}
