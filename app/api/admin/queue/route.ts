import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('id required', { status: 400 });

  const { summary_ko } = await req.json();
  if (typeof summary_ko !== 'string') return new NextResponse('summary_ko required', { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('newsletter_items').update({ summary_ko }).eq('id', id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return new NextResponse('id required', { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('newsletter_items').delete().eq('id', id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
