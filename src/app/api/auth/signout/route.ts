import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 서버에서 확실하게 로그아웃 처리.
 *
 * 클라이언트 측 best-effort signOut만으로는 sb-<ref>-auth-token cookie가
 * 남아있는 경우가 있어, 새로고침 시 미들웨어가 다시 세션 복원 → 자동 로그인 효과 발생.
 *
 * 이 라우트는 @supabase/ssr의 createServerClient(cookies()) 인스턴스에서
 * signOut을 호출해 SDK가 supabase auth cookie를 정확히 expire 처리하도록 한다.
 * 추가로 marie_profile cookie도 명시적으로 제거.
 */
export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    await supabase.auth.signOut();
  } catch {
    // 무시 — cookie 정리는 아래에서 직접 처리
  }

  // marie_profile cookie 명시적 expire
  cookieStore.set('marie_profile', '', { path: '/', maxAge: 0 });

  // 혹시 sb-* cookie가 남았으면 모두 expire 처리
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-')) {
      cookieStore.set(c.name, '', { path: '/', maxAge: 0 });
    }
  }

  return NextResponse.json({ success: true });
}
