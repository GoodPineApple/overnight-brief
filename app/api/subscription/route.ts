import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { status } = await req.json();
  if (status !== 'active' && status !== 'inactive') {
    return new NextResponse('invalid status', { status: 400 });
  }

  const { error } = await supabase.from('users').update({ status }).eq('id', user.id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // service role로 auth.users 삭제 (CASCADE로 연관 데이터 자동 삭제)
  const admin = createSupabaseAdminClient();
  await admin.from('users').delete().eq('id', user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
