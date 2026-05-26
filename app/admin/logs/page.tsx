import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { LogsClient } from './logs-client';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date ?? todayKstDate();

  const supabase = createSupabaseAdminClient();
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;

  const { data: logs } = await supabase
    .from('briefing_logs')
    .select(
      `id, sent_at, status, error_message, html_content,
       users:user_id(email),
       channel:channel_id(type, destination)`,
    )
    .gte('sent_at', start)
    .lte('sent_at', end)
    .order('sent_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">발송 로그</h1>
      <p className="text-sm text-gray-500 mb-6">{date} 발송 이력</p>
      <LogsClient initialLogs={logs ?? []} initialDate={date} />
    </div>
  );
}
