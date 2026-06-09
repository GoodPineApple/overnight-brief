'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SubscriptionSection({ initialStatus }: { initialStatus: 'active' | 'inactive' }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  async function toggleStatus() {
    const next = status === 'active' ? 'inactive' : 'active';
    const res = await fetch('/api/subscription', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setStatus(next);
      router.refresh();
    }
  }

  async function deleteAccount() {
    if (!confirm('계정과 모든 데이터를 삭제합니다. 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    const res = await fetch('/api/subscription', { method: 'DELETE' });
    if (res.ok) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-1">구독 상태</h2>
      <p className="text-gray-500 text-sm mb-4">수신을 일시 정지하거나 계정을 완전히 삭제할 수 있습니다.</p>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-500">현재 상태</div>
            <div className="font-medium">
              {status === 'active' ? '● 구독 중' : '○ 일시 정지'}
            </div>
          </div>
          <button
            onClick={toggleStatus}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {status === 'active' ? '수신 일시 정지' : '수신 재개'}
          </button>
        </div>

        <hr className="my-4 border-gray-200" />

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-red-600">계정 삭제</div>
            <div className="text-xs text-gray-500">계정과 모든 데이터를 영구 삭제합니다.</div>
          </div>
          <button
            onClick={deleteAccount}
            className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50"
          >
            계정 삭제
          </button>
        </div>
      </div>
    </section>
  );
}
