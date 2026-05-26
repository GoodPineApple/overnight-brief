import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { UserActions } from './user-actions';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
  if (!user) notFound();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: keywords }, { data: channels }, { data: logs }] = await Promise.all([
    supabase.from('keywords').select('*').eq('user_id', id).order('created_at'),
    supabase.from('notification_channels').select('*').eq('user_id', id).order('created_at'),
    supabase
      .from('briefing_logs')
      .select('*, channel:channel_id(type)')
      .eq('user_id', id)
      .gte('sent_at', sevenDaysAgo)
      .order('sent_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <Link href="/admin/users" className="text-sm text-gray-500 hover:text-black">
        ← 목록으로
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">{user.email}</h1>
      <p className="text-sm text-gray-500 mb-8">가입일 {new Date(user.created_at).toISOString().slice(0, 10)}</p>

      <UserActions userId={id} initialStatus={user.status} />

      <section className="mt-10">
        <h2 className="font-semibold mb-3">등록 키워드 ({keywords?.length ?? 0}개)</h2>
        <div className="flex flex-wrap gap-2">
          {(keywords ?? []).map((k) => (
            <span key={k.id} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
              #{k.keyword} <span className="text-xs text-blue-400">({k.news_count})</span>
            </span>
          ))}
          {(keywords ?? []).length === 0 && <p className="text-sm text-gray-400">없음</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-3">알림 채널 ({channels?.length ?? 0}개)</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y">
          {(channels ?? []).map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div className="flex-1 min-w-0">
                <span className="capitalize font-medium">{c.type}</span>
                <span className="text-gray-500 ml-2 truncate">{c.destination}</span>
              </div>
              <span className={c.is_active ? 'text-green-600' : 'text-gray-400'}>
                {c.is_active ? '● 활성' : '○ 비활성'}
              </span>
            </div>
          ))}
          {(channels ?? []).length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">없음</div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-3">최근 발송 이력 (7일)</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">시각</th>
                <th className="px-4 py-2">채널</th>
                <th className="px-4 py-2">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(logs ?? []).map((l) => {
                const channel = Array.isArray(l.channel) ? l.channel[0] : l.channel;
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-gray-600">{new Date(l.sent_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2 capitalize">{channel?.type ?? '-'}</td>
                    <td className="px-4 py-2">
                      {l.status === 'sent' ? '✅ sent' : l.status === 'failed' ? `❌ ${l.error_message ?? ''}` : '⏳ pending'}
                    </td>
                  </tr>
                );
              })}
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    발송 이력 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
