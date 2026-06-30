import type { SupabaseClient } from '@supabase/supabase-js';
import { renderNewsletterHtml } from './email-template';
import { sendEmail } from './mailer';
import type { NewsletterBrief } from './newsletter';
import { sendSlack, sendDiscord, briefToPlainText } from './notifier';

export type NotificationChannel = {
  id: string;
  type: string;
  destination: string;
  is_active: boolean;
};

export function newsletterSubject(briefingDate: string): string {
  return `[Overnight Brief] ${briefingDate} 오늘의 글로벌 테크 브리핑`;
}

export async function sendBriefToChannels(
  supabase: SupabaseClient,
  userId: string,
  channels: NotificationChannel[],
  brief: NewsletterBrief,
): Promise<number> {
  const briefingDate = brief.briefing_date;
  const subject = newsletterSubject(briefingDate);
  const html = renderNewsletterHtml(brief);
  const plainText = briefToPlainText(brief);

  let sentCount = 0;

  for (const channel of channels) {
    try {
      if (channel.type === 'email') {
        await sendEmail(channel.destination, subject, html);
      } else if (channel.type === 'slack') {
        await sendSlack(channel.destination, { title: subject, text: plainText });
      } else if (channel.type === 'discord') {
        await sendDiscord(channel.destination, { title: subject, text: plainText });
      } else {
        throw new Error(`지원하지 않는 채널 타입: ${channel.type}`);
      }

      await supabase.from('briefing_logs').insert({
        user_id: userId,
        channel_id: channel.id,
        html_content: html,
        status: 'sent',
      });
      sentCount += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('briefing_logs').insert({
        user_id: userId,
        channel_id: channel.id,
        html_content: html,
        status: 'failed',
        error_message: message,
      });
      throw Object.assign(new Error(message), { channel, userId });
    }
  }

  return sentCount;
}

/** 테스트용 — DB 채널 없이 지정 주소로 1회 발송 (briefing_logs 기록) */
export async function sendBriefToEmail(
  supabase: SupabaseClient,
  userId: string,
  to: string,
  brief: NewsletterBrief,
  channelId?: string | null,
): Promise<void> {
  const subject = newsletterSubject(brief.briefing_date);
  const html = renderNewsletterHtml(brief);

  try {
    await sendEmail(to, subject, html);
    await supabase.from('briefing_logs').insert({
      user_id: userId,
      channel_id: channelId ?? null,
      html_content: html,
      status: 'sent',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('briefing_logs').insert({
      user_id: userId,
      channel_id: channelId ?? null,
      html_content: html,
      status: 'failed',
      error_message: message,
    });
    throw err;
  }
}
