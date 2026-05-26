import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    .from('notification_channels')
    .select('*')
    .eq('user_id', userId)
    .order('created_at');
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json();
  const type = body.type as 'email' | 'slack' | 'discord';
  const destination = String(body.destination ?? '').trim();
  const label = body.label ? String(body.label).trim() : null;

  if (!['email', 'slack', 'discord'].includes(type)) {
    return new NextResponse('invalid type', { status: 400 });
  }
  if (!destination) return new NextResponse('destination required', { status: 400 });

  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    return new NextResponse('이메일 형식이 올바르지 않습니다.', { status: 400 });
  }
  if ((type === 'slack' || type === 'discord') && !/^https:\/\//.test(destination)) {
    return new NextResponse('웹훅은 https:// URL이어야 합니다.', { status: 400 });
  }

  const { data, error } = await supabase
    .from('notification_channels')
    .insert({ user_id: userId, type, destination, label, is_active: true })
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
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if (typeof body.label === 'string') updates.label = body.label;

  const { error } = await supabase
    .from('notification_channels')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('id required', { status: 400 });

  const { error } = await supabase
    .from('notification_channels')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
