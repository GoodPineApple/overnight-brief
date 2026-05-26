import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get('search') ?? '';
  const status = req.nextUrl.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1'));

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('users')
    .select('id, email, status, created_at, keywords(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) query = query.ilike('email', `%${search}%`);
  if (status === 'active' || status === 'inactive') query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, page_size: PAGE_SIZE });
}
