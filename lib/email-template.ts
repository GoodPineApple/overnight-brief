type Item = {
  matched_keyword: string | null;
  summary_ko: string;
  raw_news: { title: string | null; url: string; source: string | null } | null;
};

export function renderNewsletterHtml(items: Item[], date: string): string {
  const itemsHtml = items
    .map((item) => {
      const lines = item.summary_ko.split('\n').filter(Boolean);
      return `
        <div style="border-left: 3px solid #0070f3; padding: 12px 16px; margin-bottom: 20px; background: #f9fafb;">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
            #${item.matched_keyword ?? ''} · ${item.raw_news?.source ?? ''}
          </div>
          <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 10px;">
            ${item.raw_news?.title ?? ''}
          </div>
          <ul style="margin: 0 0 10px 18px; padding: 0; color: #374151; line-height: 1.6;">
            ${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}
          </ul>
          ${
            item.raw_news?.url
              ? `<a href="${item.raw_news.url}" style="color: #0070f3; font-size: 13px;">원문 보기 →</a>`
              : ''
          }
        </div>
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
        </header>
        <main>${itemsHtml || '<p style="color: #6b7280;">오늘 매칭된 뉴스가 없습니다.</p>'}</main>
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
