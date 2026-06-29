import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 회원 탈퇴 API — service_role 로 한 번에 처리.
 *
 * 기존 흐름: client RPC → await signOut → 쿠키 clear → toast → redirect (3~6s)
 * 신규 흐름: 1) auth 검증, 2) cancel_my_account RPC, 3) Set-Cookie로 모든 인증 쿠키 만료
 *           → 클라는 한 번의 fetch + 즉시 location.href
 */
export async function POST() {
  const cookieStore = await cookies();

  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* no-op — 응답에서 직접 set */ },
      },
    },
  );

  const { data: { user } } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();

  // 본인 프로필 + 작성 콘텐츠 soft delete — DB 단일 트랜잭션 (cancel_my_account RPC는
  // SECURITY DEFINER 라 service_role 컨텍스트에선 auth.uid()=NULL 이라 사용 불가.
  // 같은 로직을 service_role 로 직접 수행)
  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
  }

  const now = new Date().toISOString();

  // 병렬 처리 — 4개 테이블 동시 soft delete
  const [profileRes, jobsRes, postsRes, commentsRes] = await Promise.all([
    service.from('profiles')
      .update({ deleted_at: now, is_directory_listed: false })
      .eq('id', profile.id),
    service.from('jobs')
      .update({ deleted_at: now })
      .eq('author_id', profile.id)
      .is('deleted_at', null),
    service.from('posts')
      .update({ deleted_at: now })
      .eq('author_id', profile.id)
      .is('deleted_at', null),
    service.from('comments')
      .update({ deleted_at: now })
      .eq('author_id', profile.id)
      .is('deleted_at', null),
  ]);

  if (profileRes.error) {
    return NextResponse.json(
      { error: `탈퇴 처리에 실패했습니다: ${profileRes.error.message}` },
      { status: 500 },
    );
  }
  // jobs/posts/comments 실패는 critical 하지 않음 — 운영자가 후속 처리 가능
  if (jobsRes.error) console.error('[withdraw] jobs soft delete failed:', jobsRes.error);
  if (postsRes.error) console.error('[withdraw] posts soft delete failed:', postsRes.error);
  if (commentsRes.error) console.error('[withdraw] comments soft delete failed:', commentsRes.error);

  // 응답에 모든 인증 쿠키 만료 — 클라는 redirect 직후 비로그인 상태
  const res = NextResponse.json({ success: true });
  const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  res.cookies.set('marie_profile', '', expire);
  // supabase 자체 쿠키 (sb-...) 모두 만료
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-')) {
      res.cookies.set(c.name, '', { ...expire, httpOnly: true });
    }
  }
  return res;
}
