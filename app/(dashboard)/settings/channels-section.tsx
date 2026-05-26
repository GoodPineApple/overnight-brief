'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationChannel, ChannelType } from '@/lib/supabase/types';

const TYPE_META: Record<ChannelType, { icon: string; label: string; placeholder: string }> = {
  email: { icon: '📧', label: '이메일', placeholder: 'you@example.com' },
  slack: { icon: '💬', label: 'Slack', placeholder: 'https://hooks.slack.com/services/...' },
  discord: { icon: '🎮', label: 'Discord', placeholder: 'https://discord.com/api/webhooks/...' },
};

export function ChannelsSection({ initialChannels }: { initialChannels: NotificationChannel[] }) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [addType, setAddType] = useState<ChannelType | null>(null);
  const [destination, setDestination] = useState('');
  const [label, setLabel] = useState('');

  async function add() {
    if (!addType || !destination.trim()) return;
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: addType, destination: destination.trim(), label: label.trim() || null }),
    });
    if (res.ok) {
      const added = (await res.json()) as NotificationChannel;
      setChannels([...channels, added]);
      setAddType(null);
      setDestination('');
      setLabel('');
      router.refresh();
    } else {
      alert(await res.text());
    }
  }

  async function toggle(id: string, is_active: boolean) {
    await fetch(`/api/channels?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !is_active }),
    });
    setChannels(channels.map((c) => (c.id === id ? { ...c, is_active: !is_active } : c)));
  }

  async function remove(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
    setChannels(channels.filter((c) => c.id !== id));
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">알림 받을 곳</h2>
      <p className="text-gray-500 text-sm mb-4">
        이메일·Slack·Discord 웹훅 중 원하는 채널을 자유롭게 추가하세요.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        {channels.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-400 text-center">
            등록된 채널이 없습니다.
          </div>
        )}
        {channels.map((ch) => {
          const meta = TYPE_META[ch.type];
          return (
            <div key={ch.id} className="px-4 py-3 flex items-center gap-4">
              <span className="text-xl">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {meta.label}
                  {ch.label && <span className="ml-2 text-gray-500">· {ch.label}</span>}
                </div>
                <div className="text-xs text-gray-500 truncate">{ch.destination}</div>
              </div>
              <button
                onClick={() => toggle(ch.id, ch.is_active)}
                className={`text-xs px-2 py-1 rounded ${
                  ch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {ch.is_active ? '● 활성' : '○ 비활성'}
              </button>
              <button onClick={() => remove(ch.id)} className="text-sm text-red-500 hover:text-red-700">
                삭제
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-3">
        {(['email', 'slack', 'discord'] as ChannelType[]).map((t) => (
          <button
            key={t}
            onClick={() => setAddType(t)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            + {TYPE_META[t].label} 추가
          </button>
        ))}
      </div>

      {addType && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">
            {TYPE_META[addType].label} {addType === 'email' ? '주소' : '웹훅'} 추가
          </h3>
          <label className="text-sm text-gray-700 block mb-1">이름 (선택)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 회사 슬랙"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <label className="text-sm text-gray-700 block mb-1">
            {addType === 'email' ? '이메일 주소' : '웹훅 URL'}
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={TYPE_META[addType].placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAddType(null);
                setDestination('');
                setLabel('');
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md"
            >
              취소
            </button>
            <button onClick={add} className="px-3 py-1.5 text-sm bg-black text-white rounded-md">
              저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
