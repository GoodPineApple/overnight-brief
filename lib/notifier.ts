// Slack·Discord 웹훅 발송 함수

import type { NewsletterBrief } from './newsletter';

type WebhookPayload = {
  title: string;
  text: string;
};

export async function sendSlack(webhookUrl: string, payload: WebhookPayload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*${payload.title}*\n\n${payload.text}`,
    }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}

export async function sendDiscord(webhookUrl: string, payload: WebhookPayload) {
  const content = `**${payload.title}**\n\n${payload.text}`.slice(0, 1900);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
}

/** NewsletterBrief → Slack/Discord plain text */
export function briefToPlainText(brief: NewsletterBrief): string {
  let itemNum = 0;

  const sections = brief.sections.map((section) => {
    const items = section.items
      .map((item) => {
        itemNum += 1;
        const lines = item.summary_ko.split('\n').filter(Boolean).join('\n');
        return `${itemNum}. [${section.keyword}] ${item.title}\n${lines}\n${item.url}`;
      })
      .join('\n\n');

    return `## #${section.keyword}\n\n${items}`;
  });

  const header = `오늘 ${brief.total_items}건 · 키워드 ${brief.sections.length}개\n`;
  return header + sections.join('\n\n');
}

/** @deprecated briefToPlainText 사용 */
export function itemsToPlainText(
  items: { matched_keyword: string | null; summary_ko: string; raw_url?: string | null }[],
): string {
  return items
    .map((item, i) => {
      const url = item.raw_url ? `\n${item.raw_url}` : '';
      return `${i + 1}. [${item.matched_keyword ?? ''}]\n${item.summary_ko}${url}`;
    })
    .join('\n\n');
}
