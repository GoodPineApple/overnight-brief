import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error?.message ?? 'unknown')}`);
  }

  // users 테이블에 동기화 (없으면 생성)
  const admin = createSupabaseAdminClient();
  await admin.from('users').upsert(
    {
      id: data.user.id,
      email: data.user.email!,
      status: 'active',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  // 신규 유저는 이메일 채널 자동 등록
  const { data: existingChannels } = await admin
    .from('notification_channels')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('type', 'email')
    .limit(1);

  if (!existingChannels?.length) {
    await admin.from('notification_channels').insert({
      user_id: data.user.id,
      type: 'email',
      destination: data.user.email!,
      label: '기본 이메일',
      is_active: true,
    });
  }

  return NextResponse.redirect(`${origin}/settings`);
}
