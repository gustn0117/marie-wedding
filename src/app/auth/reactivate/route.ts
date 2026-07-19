import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/jobs';
  return value;
}

// 세션 쿠키를 만료시키는 redirect — 재활성화 거부/실패 시 잠금(로그아웃).
function redirectWithLogout(origin: string, request: NextRequest, path: string) {
  const res = NextResponse.redirect(`${origin}${path}`);
  const expire = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
  res.cookies.set('marie_profile', '', expire);
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-')) res.cookies.set(c.name, '', { ...expire, httpOnly: true });
  }
  return res;
}

/**
 * 탈퇴 계정 재활성화 (이메일 로그인용).
 *
 * 소셜(kakao/naver)은 /auth/callback 에서 탈퇴 프로필을 재활성화하지만 이메일 로그인엔 그런
 * 콜백이 없어, 탈퇴 후 재로그인하면 미들웨어가 매번 /login 으로 튕겨 영구 잠금처럼 보였다.
 *
 * 미들웨어는 "세션은 살아있는데 프로필이 deleted_at"(= 방금 재로그인) 상태를 이 라우트로 보낸다.
 * 여기서 소셜과 동일하게 프로필을 초기화하고 온보딩으로 보낸다.
 *
 * 단, 관리자 삭제 계정은 GoTrue ban 되어 있어(softDeleteUser) 원칙적으로 재로그인 자체가
 * 불가하지만, 밴 직전에 발급된 세션이 남아있을 수 있으므로 여기서 ban 을 명시적으로 재확인해
 * 재활성화를 거부한다(자가탈퇴만 부활 허용).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = safeNext(request.nextUrl.searchParams.get('next'));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const serviceClient = createServiceClient();

  // 관리자 삭제(GoTrue ban)면 재활성화 거부 + 세션 정리. 밴 여부 확인 자체가 실패하면
  // 안전측(fail-closed)으로 거부한다 — 확인 불가한 계정을 되살리지 않는다.
  const { data: authUser, error: authErr } = await serviceClient.auth.admin.getUserById(user.id);
  if (authErr || !authUser?.user) {
    return redirectWithLogout(origin, request, '/login?error=account_removed');
  }
  const bannedUntilRaw = (authUser.user as { banned_until?: string }).banned_until;
  if (bannedUntilRaw && new Date(bannedUntilRaw).getTime() > Date.now()) {
    return redirectWithLogout(origin, request, '/login?error=account_removed');
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, deleted_at, banned_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // 앱필드 banned_at 백스톱 — GoTrue ban 이 어떤 부분실패로 빠졌더라도(관리자 삭제는 banned_at 을
  // 먼저 남긴다) 여기서 재활성화를 거부한다. 소셜 콜백과 동일한 2급 잠금.
  if (profile?.banned_at) {
    return redirectWithLogout(origin, request, '/login?error=account_removed');
  }

  if (profile?.deleted_at) {
    // reactivate_profile_clean: bio/phone/gallery/verification_*/role 등 모든 사용자 컬럼을
    // NULL/default 로 리셋하고 deleted_at·onboarded_at 을 비운다(소유 콘텐츠는 복구 안 함).
    const { error } = await serviceClient.rpc('reactivate_profile_clean', { p_profile_id: profile.id });
    if (error) {
      // 부분 리셋(PII 잔존)으로 재활성화하지 않는다 — 초기화가 확실히 끝나야만 진입시킨다.
      console.error('[auth/reactivate] reactivate_profile_clean failed:', error);
      return redirectWithLogout(origin, request, '/login?error=reactivate_failed');
    }
    return NextResponse.redirect(`${origin}/onboarding?next=${encodeURIComponent(next)}`);
  }

  // 이미 활성(또는 프로필 없음) → 원래 목적지로.
  return NextResponse.redirect(`${origin}${next}`);
}
