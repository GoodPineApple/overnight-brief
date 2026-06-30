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
  insight_ko: string;
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

export type ComposeSectionInput = {
  keyword: string;
  insight_ko: string;
  items: ComposeInputRow[];
};

/** summary_ko / insight_ko가 비어 있지 않은 정확히 3줄인지 검증 */
export function validateSummaryKo(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length === 3;
}

/** DB rows + 섹션 인사이트 → NewsletterBrief */
export function composeNewsletterBrief(
  sections: ComposeSectionInput[],
  briefingDate: string,
): NewsletterBrief {
  const briefSections: BriefSection[] = sections
    .filter((s) => s.items.length > 0 && s.insight_ko.trim())
    .map((section) => ({
      keyword: section.keyword,
      insight_ko: section.insight_ko,
      items: section.items
        .filter((row) => row.raw_news?.url)
        .map((row) => ({
          importance_rank: row.importance_rank ?? 999,
          matched_keyword: section.keyword,
          summary_ko: row.summary_ko,
          title: row.raw_news!.title ?? '',
          source: row.raw_news!.source,
          url: row.raw_news!.url,
        }))
        .sort((a, b) => a.importance_rank - b.importance_rank),
    }));

  const total_items = briefSections.reduce((sum, s) => sum + s.items.length, 0);

  return {
    briefing_date: briefingDate,
    sections: briefSections,
    total_items,
  };
}

/** 레거시: items만 있는 경우 (insight 없음) */
export function composeNewsletterBriefFromItems(
  rows: ComposeInputRow[],
  briefingDate: string,
  keywordOrder?: string[],
  insightsByKeyword: Record<string, string> = {},
): NewsletterBrief {
  const byKeyword = new Map<string, ComposeInputRow[]>();

  for (const row of rows) {
    const keyword = row.matched_keyword?.trim();
    if (!keyword || !row.raw_news?.url) continue;
    if (!byKeyword.has(keyword)) byKeyword.set(keyword, []);
    byKeyword.get(keyword)!.push(row);
  }

  const orderedKeywords =
    keywordOrder?.filter((k) => byKeyword.has(k)) ?? [...byKeyword.keys()];

  const sections: ComposeSectionInput[] = orderedKeywords.map((keyword) => ({
    keyword,
    insight_ko: insightsByKeyword[keyword] ?? '',
    items: byKeyword.get(keyword)!,
  }));

  return composeNewsletterBrief(sections, briefingDate);
}
