import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [{ data: user }, { data: keywords }, { data: channels }, { data: logs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('keywords').select('*').eq('user_id', id),
    supabase.from('notification_channels').select('*').eq('user_id', id),
    supabase
      .from('briefing_logs')
      .select('*, channel:channel_id(type)')
      .eq('user_id', id)
      .order('sent_at', { ascending: false })
      .limit(20),
  ]);

  if (!user) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ user, keywords: keywords ?? [], channels: channels ?? [], logs: logs ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await req.json();
  if (status !== 'active' && status !== 'inactive') {
    return new NextResponse('invalid status', { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('users').update({ status }).eq('id', id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
