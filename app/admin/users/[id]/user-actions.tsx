'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UserActions({
  userId,
  initialStatus,
}: {
  userId: string;
  initialStatus: 'active' | 'inactive';
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  async function toggle() {
    const next = status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setStatus(next);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm('이 유저와 모든 연관 데이터를 영구 삭제합니다. 계속하시겠습니까?')) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/users');
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">현재 상태</div>
        <div className="text-lg font-medium">
          {status === 'active' ? '● 활성' : '○ 비활성'}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={toggle}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          {status === 'active' ? '비활성으로 변경' : '활성으로 변경'}
        </button>
        <button
          onClick={remove}
          className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
        >
          계정 삭제 ⚠
        </button>
      </div>
    </div>
  );
}
