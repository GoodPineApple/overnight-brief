/**
 * Google News /read/ · /articles/ URL → publisher URL 디코더.
 * post-2024 형식은 batchexecute API 사용 (MIT, huksley/scott2b gist 기반).
 */

const BATCH_EXECUTE_URL = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractArticleId(googleNewsUrl: string): string | null {
  try {
    const parsed = new URL(googleNewsUrl);
    if (!parsed.hostname.includes('news.google.com')) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const readIdx = parts.indexOf('read');
    if (readIdx >= 0 && parts[readIdx + 1]) {
      return parts[readIdx + 1].split('?')[0];
    }
    const articlesIdx = parts.indexOf('articles');
    if (articlesIdx >= 0 && parts[articlesIdx + 1]) {
      return parts[articlesIdx + 1].split('?')[0];
    }
    return null;
  } catch {
    return null;
  }
}

/** 구형 base64 인라인 URL (AU_yqL 이전) */
function decodeLegacyInlineUrl(base64: string): string | null {
  try {
    let str = Buffer.from(base64, 'base64').toString('binary');

    const prefix = Buffer.from([0x08, 0x13, 0x22]).toString('binary');
    if (str.startsWith(prefix)) str = str.slice(prefix.length);

    const suffix = Buffer.from([0xd2, 0x01, 0x00]).toString('binary');
    if (str.endsWith(suffix)) str = str.slice(0, -suffix.length);

    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
    const len = bytes[0];
    if (len === undefined) return null;

    if (len >= 0x80) {
      str = str.substring(2, len + 2);
    } else {
      str = str.substring(1, len + 1);
    }

    if (str.startsWith('AU_yqL') || !str.startsWith('http')) return null;
    return str;
  } catch {
    return null;
  }
}

function parseBatchExecuteResponse(body: string): string | null {
  let text = body;
  if (text.startsWith(")]}'")) {
    text = text.split('\n').slice(1).join('\n');
  }
  text = text.trim();
  const lines = text.split('\n');
  if (/^\d+$/.test(lines[0]?.trim() ?? '')) {
    text = lines.slice(1).join('\n');
  }

  const envelopes = JSON.parse(text) as unknown[];
  for (const env of envelopes) {
    if (!Array.isArray(env) || env[0] !== 'wrb.fr' || env[1] !== 'Fbv4je') continue;
    const payload = JSON.parse(String(env[2])) as unknown[];
    if (Array.isArray(payload) && payload[0] === 'garturlres' && typeof payload[1] === 'string') {
      return payload[1];
    }
  }
  return null;
}

async function decodeViaBatchExecute(
  articleId: string,
  userAgent: string,
): Promise<string | null> {
  const articlePageUrl = `https://news.google.com/rss/articles/${articleId}`;
  const pageResp = await fetch(articlePageUrl, {
    headers: { 'User-Agent': userAgent },
  });

  if (!pageResp.ok) return null;

  const html = await pageResp.text();
  const signature = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) return null;

  const rpcInner = JSON.stringify([
    'garturlreq',
    [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    articleId,
    Number(timestamp),
    signature,
  ]);

  const fReq = JSON.stringify([[['Fbv4je', rpcInner, null, 'generic']]]);
  const postResp = await fetch(`${BATCH_EXECUTE_URL}?rpcids=Fbv4je`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Referer: 'https://news.google.com/',
      'User-Agent': userAgent,
    },
    body: `f.req=${encodeURIComponent(fReq)}`,
  });

  if (!postResp.ok) return null;
  return parseBatchExecuteResponse(await postResp.text());
}

/** Google News 내부 URL → publisher 원문 URL */
export async function decodeGoogleNewsUrl(
  googleNewsUrl: string,
  options?: { userAgent?: string },
): Promise<string | null> {
  const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
  const articleId = extractArticleId(googleNewsUrl);
  if (!articleId) return null;

  const legacy = decodeLegacyInlineUrl(articleId);
  if (legacy) return legacy;

  return decodeViaBatchExecute(articleId, userAgent);
}

export function isGoogleNewsUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('news.google.com');
  } catch {
    return false;
  }
}
