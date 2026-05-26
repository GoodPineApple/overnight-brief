import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? '';
  const status = params.status ?? '';
  const page = Math.max(1, Number(params.page ?? '1'));

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('users')
    .select('id, email, status, created_at, keywords(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) query = query.ilike('email', `%${search}%`);
  if (status === 'active' || status === 'inactive') query = query.eq('status', status);

  const { data: users, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">회원 관리</h1>
      <p className="text-sm text-gray-500 mb-6">총 {count ?? 0}명</p>

      <form className="mb-4 flex items-center gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="이메일 검색..."
          className="flex-1 max-w-md px-3 py-1.5 border border-gray-300 rounded text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <button type="submit" className="px-4 py-1.5 bg-black text-white rounded text-sm">
          검색
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">가입일</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">키워드</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(users ?? []).map((u) => {
              const kwCount = Array.isArray(u.keywords) ? (u.keywords[0] as { count: number })?.count ?? 0 : 0;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(u.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'active' ? (
                      <span className="text-green-600">● 활성</span>
                    ) : (
                      <span className="text-gray-400">○ 비활성</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{kwCount}개</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="text-blue-600 hover:underline text-xs">
                      보기
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  검색 결과 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {page} / {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/admin/users?search=${search}&status=${status}&page=${page - 1}`}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              이전
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/admin/users?search=${search}&status=${status}&page=${page + 1}`}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              다음
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
