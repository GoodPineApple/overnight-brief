'use client';

import { useState } from 'react';

type Item = {
  id: string;
  user_id?: string;
  matched_keyword: string | null;
  summary_ko: string;
  importance_rank: number | null;
  users: { id: string; email: string } | { id: string; email: string }[] | null;
  raw_news: { title: string | null; url: string; source: string | null } | { title: string | null; url: string; source: string | null }[] | null;
};

type Section = {
  id: string;
  user_id: string;
  matched_keyword: string;
  insight_ko: string;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export function QueueClient({
  initialItems,
  initialSections,
}: {
  initialItems: Item[];
  initialSections: Section[];
}) {
  const [items, setItems] = useState(initialItems);
  const [sections, setSections] = useState(initialSections);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function saveItem(id: string) {
    const res = await fetch(`/api/admin/queue?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary_ko: editText }),
    });
    if (res.ok) {
      setItems(items.map((it) => (it.id === id ? { ...it, summary_ko: editText } : it)));
      setEditingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('이 아이템을 발송 큐에서 제외하시겠습니까?')) return;
    await fetch(`/api/admin/queue?id=${id}`, { method: 'DELETE' });
    setItems(items.filter((it) => it.id !== id));
  }

  const grouped = new Map<string, { email: string; items: Item[] }>();
  for (const item of items) {
    const user = pickOne(item.users);
    if (!user) continue;
    if (!grouped.has(user.id)) grouped.set(user.id, { email: user.email, items: [] });
    grouped.get(user.id)!.items.push(item);
  }

  const sectionsByUserKeyword = new Map<string, Section>();
  for (const s of sections) {
    sectionsByUserKeyword.set(`${s.user_id}:${s.matched_keyword}`, s);
  }

  if (items.length === 0 && sections.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400">
        오늘 발송 예정 뉴스레터가 없습니다.
      </div>
    );
  }

  function groupByKeyword(userItems: Item[]) {
    const byKeyword = new Map<string, Item[]>();
    for (const item of userItems) {
      const kw = item.matched_keyword ?? '(키워드 없음)';
      if (!byKeyword.has(kw)) byKeyword.set(kw, []);
      byKeyword.get(kw)!.push(item);
    }
    for (const kwItems of byKeyword.values()) {
      kwItems.sort((a, b) => (a.importance_rank ?? 999) - (b.importance_rank ?? 999));
    }
    return byKeyword;
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([userId, group]) => {
        const keywordGroups = groupByKeyword(group.items);

        return (
          <div key={userId} className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm bg-gray-50">
              {group.email} ({group.items.length}건 · 키워드 {keywordGroups.size}개)
            </div>
            <div className="divide-y">
              {Array.from(keywordGroups.entries()).map(([keyword, kwItems]) => {
                const section = sectionsByUserKeyword.get(`${userId}:${keyword}`);
                return (
                  <div key={keyword}>
                    <div className="px-5 py-2 bg-gray-50/80 text-sm font-semibold text-gray-700 border-b border-gray-100">
                      #{keyword} ({kwItems.length}건)
                    </div>
                    {section && (
                      <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100">
                        <div className="text-xs font-semibold text-blue-700 mb-1">오늘의 인사이트</div>
                        <pre className="text-sm text-blue-900 whitespace-pre-wrap font-sans">
                          {section.insight_ko}
                        </pre>
                      </div>
                    )}
                    {kwItems.map((item) => {
                      const raw = pickOne(item.raw_news);
                      return (
                        <div key={item.id} className="px-5 py-4 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 mb-1">
                                #{item.importance_rank ?? '-'} · {raw?.source}
                              </div>
                              <div className="font-medium text-sm">{raw?.title}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {editingId === item.id ? (
                                <>
                                  <button
                                    onClick={() => saveItem(item.id)}
                                    className="text-xs px-2 py-1 bg-black text-white rounded"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded"
                                  >
                                    취소
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingId(item.id);
                                      setEditText(item.summary_ko);
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => remove(item.id)}
                                    className="text-xs text-red-500 hover:underline"
                                  >
                                    삭제
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {editingId === item.id ? (
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={4}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                              {item.summary_ko}
                            </pre>
                          )}
                          {raw?.url && (
                            <a
                              href={raw.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                            >
                              원문 →
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
