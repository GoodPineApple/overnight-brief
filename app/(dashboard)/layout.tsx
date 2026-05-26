import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            OVERNIGHT BRIEF
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/settings" className="text-gray-700 hover:text-black">
              설정
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
