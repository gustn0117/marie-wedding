import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'marie_admin_unlock';

/**
 * 관리자 잠금 해제 쿠키 만료 처리.
 * AdminLayoutClient의 '잠그기' 액션 등에서 호출.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return NextResponse.json({ success: true });
}
