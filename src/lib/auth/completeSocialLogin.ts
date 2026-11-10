import 'server-only';
import type { User } from '@supabase/supabase-js';
import type { cookies } from 'next/headers';
import type { createServiceClient } from '@/lib/supabase/service';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type ServiceClient = ReturnType<typeof createServiceClient>;

export type SocialLoginOutcome =
  | { ok: true; path: string }
  | { ok: false; error: 'account_removed' | 'reactivate_failed' };

/** 로그인 후 돌아갈 경로 — 사이트 안 경로만 허용(오픈 리다이렉트 방지). */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  return value;
}

/**
 * 소셜 로그인으로 세션을 만든 뒤의 공통 마무리 — 카카오(OAuth 콜백 /auth/callback)와
 * 애플(앱 네이티브 /api/auth/apple)이 같이 쓴다.
 *
 * - 관리자 삭제(GoTrue ban)된 계정이면 방금 심은 세션 쿠키를 지우고 거부
 * - 탈퇴한 프로필이면 완전 초기화(reactivate_profile_clean) 후 새로 온보딩
 * - 처음이면 onboarded_at=null 프로필을 만들고 /onboarding 으로
 * - 그 밖에는 onboarded_at 여부에 따라 /onboarding 또는 next
 *
 * 돌려주는 path 는 사이트 안 경로다(origin 은 부르는 쪽이 붙인다).
 */
export async function completeSocialLogin(opts: {
  user: User;
  cookieStore: CookieStore;
  serviceClient: ServiceClient;
  next: string;
  /** 새 프로필에 넣을 이름. 애플은 이름을 토큰에 싣지 않고 앱이 처음 한 번만 받아 넘긴다. */
  preferredName?: string | null;
  logTag: string;
}): Promise<SocialLoginOutcome> {
  const { user, cookieStore, serviceClient, next, preferredName, logTag } = opts;
  const onboardingPath = `/onboarding?next=${encodeURIComponent(next)}`;

  // Header(SSR)가 이동 직후 첫 페이지에서 바로 사용자를 알아보도록 marie_profile 쿠키를 함께 심는다.
  // (미들웨어에 맡기면 경합으로 첫 SSR 에 쿠키가 없어 '로그인' 버튼이 잠깐 보였다)
  const setProfileCookieFromUserId = async (userId: string) => {
    const { data: p } = await serviceClient
      .from('profiles')
      .select('id, contact_name, company_name, account_type, role, region, profile_image, is_directory_listed')
      .eq('user_id', userId)
      .maybeSingle();
    if (!p) return;
    cookieStore.set('marie_profile', JSON.stringify(p), {
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
  };

  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('id, onboarded_at, deleted_at, banned_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // 관리자 삭제(GoTrue ban)면 재로그인 거부 — deleted_at 여부와 무관하게 '무조건' 최우선 확인
  // (purge 실패로 deleted_at 이 안 남아도 ban·banned_at 은 남으므로 여기서 잡는다).
  // 방금 심은 세션 쿠키를 정리한다. 밴 확인 자체가 실패해도 안전측(거부).
  if (existingProfile) {
    const { data: au, error: auErr } = await serviceClient.auth.admin.getUserById(user.id);
    const bu = (au?.user as { banned_until?: string } | undefined)?.banned_until;
    const banned = !!bu && new Date(bu).getTime() > Date.now();
    if (auErr || !au?.user || banned || existingProfile.banned_at) {
      const expire = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 };
      for (const c of cookieStore.getAll()) {
        if (c.name.startsWith('sb-')) cookieStore.set(c.name, '', expire);
      }
      cookieStore.set('marie_profile', '', { ...expire, httpOnly: false });
      return { ok: false, error: 'account_removed' };
    }
  }

  // 탈퇴한 프로필로 재로그인 → 완전 초기화 후 새로 온보딩.
  // reactivate_profile_clean RPC 가 bio/phone/gallery/verification_* 등 모든 사용자 컬럼을
  // NULL/default 로 리셋. (jobs/posts/comments 등 소유 콘텐츠는 이미 purge cascade 로
  // soft-delete 된 상태 — 복구하지 않음.)
  if (existingProfile?.deleted_at) {
    const { error: rpcErr } = await serviceClient.rpc('reactivate_profile_clean', {
      p_profile_id: existingProfile.id,
    });
    if (rpcErr) {
      // 부분 리셋(PII 잔존)으로 되살리지 않는다 — 초기화 실패 시 거부.
      console.error(`[${logTag}] reactivate_profile_clean failed:`, rpcErr);
      return { ok: false, error: 'reactivate_failed' };
    }
    await setProfileCookieFromUserId(user.id);
    return { ok: true, path: onboardingPath };
  }

  if (!existingProfile) {
    const name =
      preferredName?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0] ||
      '사용자';

    const provider =
      (user.app_metadata?.provider as string | undefined) ||
      user.identities?.[0]?.provider ||
      'email';

    // /signup 첫 단계에서 고른 회원 유형이 쿠키로 오면 미리 채운다(1회용 — 바로 지움).
    const presetRaw = cookieStore.get('signup_account_type')?.value;
    const presetAccountType =
      presetRaw === 'business' || presetRaw === 'individual' ? presetRaw : null;
    if (presetRaw) {
      cookieStore.set('signup_account_type', '', { path: '/', maxAge: 0 });
    }

    const { error: insertErr } = await serviceClient.from('profiles').insert({
      user_id: user.id,
      contact_name: name,
      account_type: presetAccountType,
      region: null,
      signup_provider: provider,
      onboarded_at: null,
    });
    if (insertErr) console.error(`[${logTag}] profile insert failed:`, insertErr);

    await setProfileCookieFromUserId(user.id);
    return { ok: true, path: onboardingPath };
  }

  await setProfileCookieFromUserId(user.id);

  if (!existingProfile.onboarded_at) {
    return { ok: true, path: onboardingPath };
  }

  return { ok: true, path: next };
}
