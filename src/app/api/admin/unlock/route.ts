import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'marie_admin_unlock';
const TTL_HOURS = 24;

/**
 * 관리자 비밀번호 검증 + 잠금 해제 쿠키 발급.
 * 통과 시 marie_admin_unlock=1, httpOnly, secure, sameSite=lax, 24h.
 */
export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const password = body.password?.trim();
  if (!password || password !== configured) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_HOURS * 60 * 60,
  });

  return NextResponse.json({ success: true });
}
