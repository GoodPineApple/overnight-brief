import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookies } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const MAX_KEYWORDS = 3;

export async function GET() {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from('keywords')
    .select('*')
    .eq('user_id', user.sub)
    .order('created_at');
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const keyword = String(body.keyword ?? '').trim();
  const news_count = clamp(Number(body.news_count ?? 10), 1, 20);
  if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 });

  const db = createSupabaseAdminClient();

  const { count } = await db
    .from('keywords')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.sub);
  if ((count ?? 0) >= MAX_KEYWORDS) {
    return NextResponse.json({ error: `키워드는 최대 ${MAX_KEYWORDS}개까지 등록 가능합니다.` }, { status: 400 });
  }

  const { data, error } = await db
    .from('keywords')
    .insert({ user_id: user.sub, keyword, news_count })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.news_count === 'number') updates.news_count = clamp(body.news_count, 1, 20);

  const db = createSupabaseAdminClient();
  const { error } = await db.from('keywords').update(updates).eq('id', id).eq('user_id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = createSupabaseAdminClient();
  const { error } = await db.from('keywords').delete().eq('id', id).eq('user_id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
