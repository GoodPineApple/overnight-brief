'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  async function handleGoogle() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-8">Overnight Brief</h1>

        <button
          onClick={handleGoogle}
          className="w-full py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
        >
          Google 계정으로 계속하기
        </button>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="px-3 text-xs text-gray-400">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label className="block text-sm text-gray-700">이메일 주소</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full py-2.5 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {status === 'sending' ? '전송 중...' : '매직 링크 보내기'}
          </button>
        </form>

        {status === 'sent' && (
          <p className="mt-4 text-sm text-green-600 text-center">
            ✓ 이메일로 로그인 링크를 보냈습니다. 메일함을 확인해주세요.
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-red-600 text-center">{errorMsg}</p>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed">
          가입/로그인 구분 없음.
          <br />
          링크 클릭 시 자동으로 계정이 생성됩니다.
        </p>
      </div>
    </div>
  );
}
