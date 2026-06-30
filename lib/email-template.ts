import type { NewsletterBrief } from './newsletter';

export function renderNewsletterHtml(brief: NewsletterBrief): string {
  const { briefing_date: date, sections, total_items } = brief;
  const sectionCount = sections.length;

  const sectionsHtml = sections
    .map((section) => {
      const insightLines = section.insight_ko.split('\n').filter(Boolean);
      const insightHtml = `
        <div style="background: #eff6ff; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 600; color: #1d4ed8; margin-bottom: 8px;">오늘의 인사이트</div>
          <ul style="margin: 0 0 0 18px; padding: 0; color: #1e3a5f; line-height: 1.6;">
            ${insightLines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
        </div>
      `;

      const itemsHtml = section.items
        .map((item) => {
          const lines = item.summary_ko.split('\n').filter(Boolean);
          return `
        <div style="border-left: 3px solid #0070f3; padding: 12px 16px; margin-bottom: 16px; background: #f9fafb;">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
            #${item.importance_rank} · ${escapeHtml(item.source ?? '')}
          </div>
          <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 10px;">
            ${escapeHtml(item.title)}
          </div>
          <ul style="margin: 0 0 10px 18px; padding: 0; color: #374151; line-height: 1.6;">
            ${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
          <a href="${escapeHtml(item.url)}" style="color: #0070f3; font-size: 13px;">원문 보기 →</a>
        </div>
      `;
        })
        .join('');

      return `
      <section style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
          #${escapeHtml(section.keyword)}
        </h2>
        ${insightHtml}
        ${itemsHtml}
      </section>
    `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="ko">
      <head><meta charset="utf-8" /><title>Overnight Brief</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #ffffff;">
        <header style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; color: #111827;">Overnight Brief</h1>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">${date} · 밤사이 글로벌 테크 뉴스 요약</p>
          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 13px;">오늘 ${total_items}건 · 키워드 ${sectionCount}개</p>
        </header>
        <main>${sectionsHtml || '<p style="color: #6b7280;">오늘 매칭된 뉴스가 없습니다.</p>'}</main>
        <footer style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
          <p>이 메일은 Overnight Brief 구독자에게 자동 발송됩니다.</p>
        </footer>
      </body>
    </html>
  `;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
