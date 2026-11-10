import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';
import { apiFetch } from '@/shared/utils/apiFetch';

/**
 * 로그아웃 후 홈으로 — 머리글 계정 메뉴(웹)와 앱 '마이' 탭이 같이 쓴다.
 * 서버 라우트가 세션 revoke + httpOnly 쿠키(sb-*, marie_profile) 만료를 모두 처리하므로 그것만 기다리고(보통 ~100ms)
 * 바로 이동한다. 클라이언트 supabase.auth.signOut()(GoTrue revoke)은 서버가 이미 하므로 생략.
 */
export async function signOutAndGoHome(): Promise<void> {
  // 클라이언트 측 즉시 정리 (UI 반응 보장)
  clearMarieProfileCookie();

  // localStorage / sessionStorage의 supabase 세션 토큰 모두 제거
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('sb-')) sessionStorage.removeItem(k);
    });
  } catch {}

  try {
    await apiFetch('/api/auth/signout', { method: 'POST', credentials: 'include' }, 2000);
  } catch {
    // 무시 — full reload 로 미들웨어가 다시 처리
  }

  window.location.href = '/';
}
