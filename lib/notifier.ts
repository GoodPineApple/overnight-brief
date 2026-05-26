// Slack·Discord 웹훅 발송 함수
// HTML을 마크다운/플레인 텍스트로 단순화해서 전송

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
  // Discord 메시지 최대 2000자 제한
  const content = `**${payload.title}**\n\n${payload.text}`.slice(0, 1900);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
}

// 발송 큐 아이템을 텍스트 형식으로 변환
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
