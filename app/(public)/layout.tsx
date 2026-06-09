import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            OVERNIGHT BRIEF
          </Link>
          <div className="flex gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-sm hover:underline">
              로그인
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 text-sm bg-black text-white rounded-md hover:bg-gray-800"
            >
              시작하기
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
