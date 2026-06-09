import { redirect } from 'next/navigation';
import { getUserFromCookies } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { KeywordsSection } from './keywords-section';
import { ChannelsSection } from './channels-section';
import { SubscriptionSection } from './subscription-section';

export default async function SettingsPage() {
  const user = await getUserFromCookies();
  if (!user) redirect('/auth/login');

  const db = createSupabaseAdminClient();

  const [{ data: userRow }, { data: keywords }, { data: channels }] = await Promise.all([
    db.from('users').select('status').eq('id', user.sub).single(),
    db.from('keywords').select('*').eq('user_id', user.sub).order('created_at'),
    db.from('notification_channels').select('*').eq('user_id', user.sub).order('created_at'),
  ]);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-bold mb-1">설정</h1>
        <p className="text-gray-500 text-sm">키워드·알림 채널·구독 상태를 관리합니다.</p>
      </div>

      <KeywordsSection initialKeywords={keywords ?? []} />
      <ChannelsSection initialChannels={channels ?? []} />
      <SubscriptionSection initialStatus={(userRow?.status as 'active' | 'inactive') ?? 'active'} />
    </div>
  );
}
