import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 어드민 영역: admin_token 쿠키 검증
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminToken = req.cookies.get('admin_token')?.value;
    if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    return NextResponse.next();
  }

  // 대시보드·유저 API: JWT 세션 검증
  const token = getTokenFromRequest(req);
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/settings/:path*',
    '/api/keywords/:path*',
    '/api/channels/:path*',
    '/api/subscription/:path*',
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
