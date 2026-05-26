'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }
  return (
    <button onClick={handleLogout} className="text-gray-500 hover:text-black">
      로그아웃
    </button>
  );
}
