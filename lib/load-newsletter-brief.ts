import type { SupabaseClient } from '@supabase/supabase-js';
import {
  composeNewsletterBrief,
  type ComposeInputRow,
  type ComposeSectionInput,
} from './newsletter';

export async function loadNewsletterBriefForUser(
  supabase: SupabaseClient,
  userId: string,
  briefingDate: string,
  keywordOrder: string[],
) {
  const [{ data: sections }, { data: items }] = await Promise.all([
    supabase
      .from('newsletter_sections')
      .select('matched_keyword, insight_ko')
      .eq('user_id', userId)
      .eq('briefing_date', briefingDate),
    supabase
      .from('newsletter_items')
      .select(
        `matched_keyword, summary_ko, importance_rank,
         raw_news:raw_news_id(title, url, source)`,
      )
      .eq('user_id', userId)
      .eq('briefing_date', briefingDate),
  ]);

  if (!items?.length && !sections?.length) return null;

  const insightByKeyword = new Map(
    (sections ?? []).map((s) => [s.matched_keyword, s.insight_ko]),
  );

  const itemsByKeyword = new Map<string, ComposeInputRow[]>();
  for (const item of items ?? []) {
    const kw = item.matched_keyword?.trim();
    if (!kw) continue;
    if (!itemsByKeyword.has(kw)) itemsByKeyword.set(kw, []);
    itemsByKeyword.get(kw)!.push({
      matched_keyword: item.matched_keyword,
      summary_ko: item.summary_ko,
      importance_rank: item.importance_rank,
      raw_news: item.raw_news as ComposeInputRow['raw_news'],
    });
  }

  const allKeywords = new Set([...insightByKeyword.keys(), ...itemsByKeyword.keys()]);
  const ordered = keywordOrder.filter((k) => allKeywords.has(k));
  for (const k of allKeywords) {
    if (!ordered.includes(k)) ordered.push(k);
  }

  const composeSections: ComposeSectionInput[] = ordered
    .map((keyword) => ({
      keyword,
      insight_ko: insightByKeyword.get(keyword) ?? '',
      items: itemsByKeyword.get(keyword) ?? [],
    }))
    .filter((s) => s.insight_ko && s.items.length > 0);

  if (!composeSections.length) return null;

  return composeNewsletterBrief(composeSections, briefingDate);
}
