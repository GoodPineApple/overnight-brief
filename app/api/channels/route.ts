import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookies } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from('notification_channels')
    .select('*')
    .eq('user_id', user.sub)
    .order('created_at');
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const type = body.type as 'email' | 'slack' | 'discord';
  const destination = String(body.destination ?? '').trim();
  const label = body.label ? String(body.label).trim() : null;

  if (!['email', 'slack', 'discord'].includes(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 });
  }
  if (!destination) return NextResponse.json({ error: 'destination required' }, { status: 400 });

  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if ((type === 'slack' || type === 'discord') && !/^https:\/\//.test(destination)) {
    return NextResponse.json({ error: '웹훅은 https:// URL이어야 합니다.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('notification_channels')
    .insert({ user_id: user.sub, type, destination, label, is_active: true })
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
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.label === 'string') updates.label = body.label;

  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('notification_channels')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('notification_channels')
    .delete()
    .eq('id', id)
    .eq('user_id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
