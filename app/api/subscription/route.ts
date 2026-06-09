import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookies } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await req.json();
  if (status !== 'active' && status !== 'inactive') {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { error } = await db.from('users').update({ status }).eq('id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createSupabaseAdminClient();
  const { error } = await db.from('users').delete().eq('id', user.sub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
