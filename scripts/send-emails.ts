// 오전 8시 KST 실행 — newsletter → 채널별 발송 → briefing_logs 기록
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import { todayKstDate } from '../lib/kst-date';
import { loadNewsletterBriefForUser } from '../lib/load-newsletter-brief';
import { requireGmailEnv, requireSupabaseEnv } from '../lib/require-env';
import { sendBriefToChannels, type NotificationChannel } from '../lib/send-newsletter';

async function main() {
  requireSupabaseEnv();
  requireGmailEnv();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const briefingDate = todayKstDate();
  console.log(`[send-emails] 발송 날짜: ${briefingDate}`);

  const { data: users, error } = await supabase
    .from('users')
    .select(
      `id, email, status,
       keywords(keyword, created_at),
       notification_channels(id, type, destination, is_active)`,
    )
    .eq('status', 'active');

  if (error) {
    console.error('[send-emails] 유저 로드 실패:', error);
    process.exit(1);
  }

  let sentCount = 0;

  for (const user of users ?? []) {
    const channels = (
      (user.notification_channels ?? []) as NotificationChannel[]
    ).filter((c) => c.is_active);

    if (!channels.length) {
      console.log(`[send-emails] ${user.email}: 활성 채널 없음. 건너뜀.`);
      continue;
    }

    const keywordOrder = (
      (user.keywords ?? []) as { keyword: string; created_at: string }[]
    )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((k) => k.keyword);

    const brief = await loadNewsletterBriefForUser(
      supabase,
      user.id,
      briefingDate,
      keywordOrder,
    );

    if (!brief) {
      console.log(`[send-emails] ${user.email}: 오늘 뉴스레터 없음. 건너뜀.`);
      continue;
    }

    for (const channel of channels) {
      try {
        await sendBriefToChannels(supabase, user.id, [channel], brief);
        console.log(`[send-emails] ✅ ${user.email} via ${channel.type}`);
        sentCount += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const failedChannel = (err as { channel?: NotificationChannel }).channel;
        const via = failedChannel?.type ?? channel.type;
        console.error(`[send-emails] ❌ ${user.email} via ${via}: ${message}`);
      }
    }
  }

  if (!sentCount) {
    console.log('[send-emails] 발송 완료 건 없음.');
  }
  console.log('[send-emails] 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
