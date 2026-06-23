export type BriefItem = {
  importance_rank: number;
  matched_keyword: string;
  summary_ko: string;
  title: string;
  source: string | null;
  url: string;
};

export type BriefSection = {
  keyword: string;
  items: BriefItem[];
};

export type NewsletterBrief = {
  briefing_date: string;
  sections: BriefSection[];
  total_items: number;
};

export type ComposeInputRow = {
  matched_keyword: string | null;
  summary_ko: string;
  importance_rank: number | null;
  raw_news: {
    title: string | null;
    url: string;
    source: string | null;
  } | null;
};

/** summary_ko가 비어 있지 않은 정확히 3줄인지 검증 */
export function validateSummaryKo(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length === 3;
}

/** DB rows → 키워드 섹션별 NewsletterBrief */
export function composeNewsletterBrief(
  rows: ComposeInputRow[],
  briefingDate: string,
  keywordOrder?: string[],
): NewsletterBrief {
  const byKeyword = new Map<string, BriefItem[]>();

  for (const row of rows) {
    const keyword = row.matched_keyword?.trim();
    if (!keyword || !row.raw_news?.url) continue;

    const item: BriefItem = {
      importance_rank: row.importance_rank ?? 999,
      matched_keyword: keyword,
      summary_ko: row.summary_ko,
      title: row.raw_news.title ?? '',
      source: row.raw_news.source,
      url: row.raw_news.url,
    };

    if (!byKeyword.has(keyword)) byKeyword.set(keyword, []);
    byKeyword.get(keyword)!.push(item);
  }

  const orderedKeywords =
    keywordOrder?.filter((k) => byKeyword.has(k)) ??
    [...byKeyword.keys()];

  const sections: BriefSection[] = orderedKeywords.map((keyword) => ({
    keyword,
    items: byKeyword
      .get(keyword)!
      .sort((a, b) => a.importance_rank - b.importance_rank),
  }));

  const total_items = sections.reduce((sum, s) => sum + s.items.length, 0);

  return {
    briefing_date: briefingDate,
    sections,
    total_items,
  };
}
