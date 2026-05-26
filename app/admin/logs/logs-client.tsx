'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Log = {
  id: string;
  sent_at: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  html_content: string | null;
  users: { email: string } | { email: string }[] | null;
  channel: { type: string; destination: string } | { type: string; destination: string }[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export function LogsClient({ initialLogs, initialDate }: { initialLogs: Log[]; initialDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [selected, setSelected] = useState<Log | null>(null);

  function changeDate(d: string) {
    setDate(d);
    router.push(`/admin/logs?date=${d}`);
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-600">날짜:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">유저</th>
              <th className="px-4 py-3">채널</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initialLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  발송 로그가 없습니다.
                </td>
              </tr>
            )}
            {initialLogs.map((log) => {
              const user = pickOne(log.users);
              const channel = pickOne(log.channel);
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(log.sent_at).toLocaleTimeString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">{user?.email ?? '-'}</td>
                  <td className="px-4 py-3 capitalize">{channel?.type ?? '-'}</td>
                  <td className="px-4 py-3">
                    {log.status === 'sent' ? (
                      <span className="text-green-600">✅ sent</span>
                    ) : log.status === 'failed' ? (
                      <span className="text-red-600">❌ failed</span>
                    ) : (
                      <span className="text-gray-500">⏳ pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(log)} className="text-xs text-blue-600 hover:underline">
                      보기
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-end z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-2xl h-full overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">발송 상세</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-black">
                ✕
              </button>
            </div>
            <dl className="text-sm space-y-2 mb-6">
              <Row label="시각" value={new Date(selected.sent_at).toLocaleString('ko-KR')} />
              <Row label="유저" value={pickOne(selected.users)?.email ?? '-'} />
              <Row label="채널" value={`${pickOne(selected.channel)?.type ?? ''} · ${pickOne(selected.channel)?.destination ?? ''}`} />
              <Row label="상태" value={selected.status} />
              {selected.error_message && <Row label="에러" value={selected.error_message} />}
            </dl>
            {selected.html_content && (
              <div>
                <div className="text-xs text-gray-500 mb-2">발송 본문</div>
                <iframe
                  srcDoc={selected.html_content}
                  className="w-full h-96 border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <dt className="w-20 text-gray-500">{label}</dt>
      <dd className="flex-1 text-gray-900 break-all">{value}</dd>
    </div>
  );
}
