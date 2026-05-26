import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const adminToken = req.cookies.get('admin_token')?.value;
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
