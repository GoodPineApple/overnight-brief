import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const today = todayKstDate();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: rawCount }, { count: itemCount }, { count: totalUsers }, { data: logs }] = await Promise.all([
    supabase
      .from('raw_news')
      .select('*', { count: 'exact', head: true })
      .gte('collected_at', `${today}T00:00:00Z`),
    supabase.from('newsletter_items').select('*', { count: 'exact', head: true }).eq('briefing_date', today),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('briefing_logs').select('status').gte('sent_at', sevenDaysAgo),
  ]);

  const total = logs?.length ?? 0;
  const sent = logs?.filter((l) => l.status === 'sent').length ?? 0;

  return NextResponse.json({
    date: today,
    raw_news_today: rawCount ?? 0,
    newsletter_items_today: itemCount ?? 0,
    total_users: totalUsers ?? 0,
    last7days: {
      total,
      sent,
      failed: total - sent,
      success_rate: total ? Number(((sent / total) * 100).toFixed(1)) : null,
    },
  });
}
