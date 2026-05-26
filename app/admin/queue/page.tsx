import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { QueueClient } from './queue-client';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function AdminQueuePage() {
  const supabase = createSupabaseAdminClient();
  const today = todayKstDate();

  const { data: items } = await supabase
    .from('newsletter_items')
    .select(
      `id, matched_keyword, summary_ko, importance_rank,
       users:user_id(id, email),
       raw_news:raw_news_id(title, url, source)`,
    )
    .eq('briefing_date', today)
    .order('user_id')
    .order('importance_rank', { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">오늘 발송 큐</h1>
      <p className="text-sm text-gray-500 mb-6">{today} 발송 예정 아이템</p>
      <QueueClient initialItems={items ?? []} />
    </div>
  );
}
