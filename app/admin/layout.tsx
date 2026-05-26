import Link from 'next/link';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/queue', label: '큐 미리보기' },
  { href: '/admin/logs', label: '발송 로그' },
  { href: '/admin/users', label: '회원 관리' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex">
      <aside className="w-56 bg-gray-900 text-white px-4 py-6">
        <div className="font-bold text-sm mb-6 px-2">OVERNIGHT BRIEF · 어드민</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-gray-50 px-8 py-8 overflow-auto">{children}</main>
    </div>
  );
}
