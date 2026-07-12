import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 클라이언트 mutation 후 호출 — 다른 페이지의 fetch 캐시 무효화.
 *
 * 인증:
 *  1. 로그인된 사용자 요청 (marie 세션 쿠키)
 *  2. 또는 X-Revalidate-Secret 헤더가 REVALIDATE_SECRET 과 일치 (내부 job 용)
 *
 * DoS 방지: paths 배열 최대 20개.
 */
const MAX_PATHS = 20;

export async function POST(req: Request) {
  // (1) 시크릿 헤더 통과
  const secret = req.headers.get('x-revalidate-secret');
  const configured = process.env.REVALIDATE_SECRET;
  const secretOk = !!configured && secret === configured;

  // (2) 로그인 세션 통과
  let sessionOk = false;
  if (!secretOk) {
    try {
      const cookieStore = await cookies();
      const ssr = createServerClient(
        SUPABASE_SERVER_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() { /* no-op */ },
          },
        },
      );
      const { data: { user } } = await ssr.auth.getUser();
      sessionOk = !!user;
    } catch {}
  }

  if (!secretOk && !sessionOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { paths } = (await req.json()) as { paths?: string[] };
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: 'paths array required' }, { status: 400 });
    }
    if (paths.length > MAX_PATHS) {
      return NextResponse.json({ error: `paths limit ${MAX_PATHS}` }, { status: 400 });
    }
    let count = 0;
    for (const path of paths) {
      if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) {
        revalidatePath(path);
        count++;
      }
    }
    return NextResponse.json({ ok: true, revalidated: count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 });
  }
}
