import { createSupabaseAdminClient } from '@/lib/supabase/server';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function AdminDashboard() {
  const supabase = createSupabaseAdminClient();
  const today = todayKstDate();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: rawCount },
    { count: itemCount },
    { count: pendingSend },
    { count: totalUsers },
    { count: activeUsers },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from('raw_news')
      .select('*', { count: 'exact', head: true })
      .gte('collected_at', `${today}T00:00:00Z`),
    supabase
      .from('newsletter_items')
      .select('*', { count: 'exact', head: true })
      .eq('briefing_date', today),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('briefing_logs').select('status').gte('sent_at', sevenDaysAgo),
  ]);

  const total7d = recentLogs?.length ?? 0;
  const sent7d = recentLogs?.filter((l) => l.status === 'sent').length ?? 0;
  const failed7d = recentLogs?.filter((l) => l.status === 'failed').length ?? 0;
  const successRate = total7d ? ((sent7d / total7d) * 100).toFixed(1) : '—';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">파이프라인 현황</h1>
      <p className="text-sm text-gray-500 mb-8">{today} (KST)</p>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">오늘 파이프라인</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="수집" time="새벽 2시" value={rawCount ?? 0} suffix="건" />
          <StatCard label="AI 처리" time="새벽 4시" value={itemCount ?? 0} suffix="아이템" />
          <StatCard label="발송 예정" time="오전 8시" value={pendingSend ?? 0} suffix="명" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">전체 유저 통계</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="총 구독자" value={totalUsers ?? 0} suffix="명" />
          <StatCard label="활성" value={activeUsers ?? 0} suffix="명" />
          <StatCard label="비활성" value={(totalUsers ?? 0) - (activeUsers ?? 0)} suffix="명" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">최근 7일 발송 성공률</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-3xl font-bold mb-2">{successRate}%</div>
          <div className="text-sm text-gray-500">
            총 {total7d}건 발송 · 성공 {sent7d}건 · 실패 {failed7d}건
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  time,
  value,
  suffix,
}: {
  label: string;
  time?: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {time && <div className="text-xs text-gray-400 mb-2">{time}</div>}
      <div className="text-2xl font-bold">
        {value} <span className="text-base text-gray-400 font-normal">{suffix}</span>
      </div>
    </div>
  );
}
