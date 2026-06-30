import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { QueueClient } from './queue-client';
import { todayKstDate } from '@/lib/kst-date';

export default async function AdminQueuePage() {
  const supabase = createSupabaseAdminClient();
  const today = todayKstDate();

  const [{ data: items }, { data: sections }] = await Promise.all([
    supabase
      .from('newsletter_items')
      .select(
        `id, user_id, matched_keyword, summary_ko, importance_rank,
         users:user_id(id, email),
         raw_news:raw_news_id(title, url, source)`,
      )
      .eq('briefing_date', today)
      .order('importance_rank', { ascending: true }),
    supabase
      .from('newsletter_sections')
      .select('id, user_id, matched_keyword, insight_ko')
      .eq('briefing_date', today),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">오늘 발송 큐</h1>
      <p className="text-sm text-gray-500 mb-6">{today} · 키워드별 인사이트 + 기사 요약</p>
      <QueueClient initialItems={items ?? []} initialSections={sections ?? []} />
    </div>
  );
}
