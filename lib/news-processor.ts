export type RawNewsCandidate = {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string | null;
  published_at: string | null;
};

export type NewsletterInsertRow = {
  user_id: string;
  raw_news_id: string;
  matched_keyword: string;
  summary_ko: string;
  importance_rank: number;
  briefing_date: string;
};

function matchesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function relevanceScore(news: RawNewsCandidate, keyword: string): number {
  const kw = keyword.toLowerCase();
  const title = (news.title ?? '').toLowerCase();
  const content = (news.content ?? '').toLowerCase();
  let score = 0;
  if (title.includes(kw)) score += 2;
  if (content.includes(kw)) score += 1;
  return score;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** 키워드 substring 매칭 후 관련도·신선도 기준 상위 limit건 선별 */
export function filterAndRankNews(
  news: RawNewsCandidate[],
  keyword: string,
  limit: number,
  excludeIds: Set<string> = new Set(),
): RawNewsCandidate[] {
  const matched = news.filter(
    (n) =>
      !excludeIds.has(n.id) &&
      (matchesKeyword(n.title ?? '', keyword) || matchesKeyword(n.content ?? '', keyword)),
  );

  const seenTitles = new Set<string>();
  const deduped: RawNewsCandidate[] = [];

  for (const item of matched.sort((a, b) => {
    const scoreDiff = relevanceScore(b, keyword) - relevanceScore(a, keyword);
    if (scoreDiff !== 0) return scoreDiff;
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  })) {
    const key = normalizeTitle(item.title ?? '');
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

export function buildNewsletterRows(
  userId: string,
  keyword: string,
  candidates: RawNewsCandidate[],
  summaries: { raw_index: number; summary_ko: string; importance_rank: number }[],
  briefingDate: string,
): NewsletterInsertRow[] {
  return summaries
    .filter((s) => candidates[s.raw_index])
    .map((s) => ({
      user_id: userId,
      raw_news_id: candidates[s.raw_index].id,
      matched_keyword: keyword,
      summary_ko: s.summary_ko,
      importance_rank: s.importance_rank,
      briefing_date: briefingDate,
    }));
}
