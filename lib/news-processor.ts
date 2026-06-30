export type RawNewsCandidate = {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string | null;
  published_at: string | null;
  rank_in_batch?: number;
};

export type NewsletterInsertRow = {
  user_id: string;
  raw_news_id: string;
  matched_keyword: string;
  summary_ko: string;
  importance_rank: number;
  briefing_date: string;
};

export type NewsletterSectionInsertRow = {
  user_id: string;
  matched_keyword: string;
  insight_ko: string;
  briefing_date: string;
};

/** 유저 news_count만큼 수집 순서대로 자른다 (substring 매칭 없음) */
export function sliceCollectedNews(
  articles: RawNewsCandidate[],
  newsCount: number,
): RawNewsCandidate[] {
  const limit = Math.max(1, Math.min(20, newsCount ?? 10));
  return [...articles]
    .sort((a, b) => (a.rank_in_batch ?? 999) - (b.rank_in_batch ?? 999))
    .slice(0, limit);
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
