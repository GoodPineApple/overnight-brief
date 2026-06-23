// 오전 8시 KST 실행 — newsletter_items → 채널별 발송 → briefing_logs 기록
import '../lib/load-env';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../lib/mailer';
import { sendSlack, sendDiscord, briefToPlainText } from '../lib/notifier';
import { renderNewsletterHtml } from '../lib/email-template';
import { composeNewsletterBrief } from '../lib/newsletter';

function todayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const briefingDate = todayKstDate();
  console.log(`[send-emails] 발송 날짜: ${briefingDate}`);

  const { data: items, error } = await supabase
    .from('newsletter_items')
    .select(
      `id, user_id, matched_keyword, summary_ko, importance_rank,
       raw_news:raw_news_id(title, url, source),
       users:user_id(id, email, status, keywords(keyword, created_at), notification_channels(id, type, destination, is_active))`,
    )
    .eq('briefing_date', briefingDate);

  if (error) {
    console.error('[send-emails] 큐 로드 실패:', error);
    process.exit(1);
  }
  if (!items?.length) {
    console.log('[send-emails] 오늘 발송할 아이템 없음. 종료.');
    return;
  }

  type ItemRow = (typeof items)[number];
  const byUser = new Map<string, ItemRow[]>();
  for (const item of items) {
    if (!byUser.has(item.user_id)) byUser.set(item.user_id, []);
    byUser.get(item.user_id)!.push(item);
  }

  console.log(`[send-emails] 발송 대상 유저: ${byUser.size}명`);

  for (const [userId, userItems] of byUser) {
    const userRow = userItems[0].users as unknown as {
      id: string;
      email: string;
      status: string;
      keywords: { keyword: string; created_at: string }[];
      notification_channels: { id: string; type: string; destination: string; is_active: boolean }[];
    } | null;

    if (!userRow || userRow.status !== 'active') continue;

    const channels = (userRow.notification_channels ?? []).filter((c) => c.is_active);
    if (!channels.length) {
      console.log(`[send-emails] ${userRow.email}: 활성 채널 없음. 건너뜀.`);
      continue;
    }

    const keywordOrder = (userRow.keywords ?? [])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((k) => k.keyword);

    const brief = composeNewsletterBrief(
      userItems.map((it) => ({
        matched_keyword: it.matched_keyword,
        summary_ko: it.summary_ko,
        importance_rank: it.importance_rank,
        raw_news: it.raw_news as unknown as {
          title: string | null;
          url: string;
          source: string | null;
        } | null,
      })),
      briefingDate,
      keywordOrder,
    );

    if (brief.total_items === 0) {
      console.log(`[send-emails] ${userRow.email}: 조립 결과 0건. 건너뜀.`);
      continue;
    }

    const subject = `[Overnight Brief] ${briefingDate} 오늘의 글로벌 테크 브리핑`;
    const html = renderNewsletterHtml(brief);
    const plainText = briefToPlainText(brief);

    for (const channel of channels) {
      try {
        if (channel.type === 'email') {
          await sendEmail(channel.destination, subject, html);
        } else if (channel.type === 'slack') {
          await sendSlack(channel.destination, { title: subject, text: plainText });
        } else if (channel.type === 'discord') {
          await sendDiscord(channel.destination, { title: subject, text: plainText });
        }
        await supabase.from('briefing_logs').insert({
          user_id: userId,
          channel_id: channel.id,
          html_content: html,
          status: 'sent',
        });
        console.log(`[send-emails] ✅ ${userRow.email} via ${channel.type}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase.from('briefing_logs').insert({
          user_id: userId,
          channel_id: channel.id,
          html_content: html,
          status: 'failed',
          error_message: message,
        });
        console.error(`[send-emails] ❌ ${userRow.email} via ${channel.type}: ${message}`);
      }
    }
  }

  console.log('[send-emails] 완료.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
