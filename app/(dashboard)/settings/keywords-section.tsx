'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Keyword } from '@/lib/supabase/types';

export function KeywordsSection({ initialKeywords }: { initialKeywords: Keyword[] }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState(initialKeywords);
  const [showAdd, setShowAdd] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [newCount, setNewCount] = useState(10);

  async function addKeyword() {
    if (!newKw.trim()) return;
    const res = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: newKw.trim(), news_count: newCount }),
    });
    if (res.ok) {
      const added = (await res.json()) as Keyword;
      setKeywords([...keywords, added]);
      setNewKw('');
      setNewCount(10);
      setShowAdd(false);
      router.refresh();
    } else {
      alert(await res.text());
    }
  }

  async function deleteKeyword(id: string) {
    await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' });
    setKeywords(keywords.filter((k) => k.id !== id));
    router.refresh();
  }

  async function updateCount(id: string, count: number) {
    await fetch(`/api/keywords?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ news_count: count }),
    });
    setKeywords(keywords.map((k) => (k.id === id ? { ...k, news_count: count } : k)));
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">관심 키워드</h2>
      <p className="text-gray-500 text-sm mb-4">
        최대 3개까지 등록할 수 있습니다. 각 키워드별 인사이트 생성에 사용할 뉴스 수도 조절 가능합니다.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {keywords.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">
            등록된 키워드가 없습니다.
          </div>
        )}
        {keywords.map((kw) => (
          <div key={kw.id} className="px-4 py-3 flex items-center gap-4">
            <div className="font-medium flex-1">{kw.keyword}</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={20}
                value={kw.news_count}
                onChange={(e) => updateCount(kw.id, Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-gray-600 w-12 text-right">{kw.news_count}개</span>
            </div>
            <button
              onClick={() => deleteKeyword(kw.id)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {keywords.length < 3 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          + 키워드 추가
        </button>
      )}

      {showAdd && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <input
            type="text"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            placeholder="예: AI바이브코딩"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <label className="text-sm text-gray-700 block mb-1">
            뉴스 수: <span className="font-medium">{newCount}개</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={newCount}
            onChange={(e) => setNewCount(Number(e.target.value))}
            className="w-full mb-3"
          />
          <p className="text-xs text-gray-500 mb-3">
            많을수록 더 다양한 관점 반영, 적을수록 핵심 뉴스만 요약 (1~20개).
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
            >
              취소
            </button>
            <button
              onClick={addKeyword}
              className="px-3 py-1.5 text-sm bg-black text-white rounded-md"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
