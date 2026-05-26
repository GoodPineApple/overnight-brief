import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_KEYWORDS = 3;

async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function GET() {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const { data } = await supabase
    .from('keywords')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const keyword = String(body.keyword ?? '').trim();
  const news_count = clamp(Number(body.news_count ?? 10), 1, 20);
  if (!keyword) return new NextResponse('keyword required', { status: 400 });

  const { count } = await supabase
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) >= MAX_KEYWORDS) {
    return new NextResponse(`키워드는 최대 ${MAX_KEYWORDS}개까지 등록 가능합니다.`, { status: 400 });
  }

  const { data, error } = await supabase
    .from('keywords')
    .insert({ user_id: userId, keyword, news_count })
    .select()
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('id required', { status: 400 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.news_count === 'number') updates.news_count = clamp(body.news_count, 1, 20);

  const { error } = await supabase.from('keywords').update(updates).eq('id', id).eq('user_id', userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('id required', { status: 400 });

  const { error } = await supabase.from('keywords').delete().eq('id', id).eq('user_id', userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
