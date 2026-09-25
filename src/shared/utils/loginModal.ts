// PC 로그인 창(LoginModalHost) 열기 — 서버에 다녀오지 않고 보던 화면 위에 바로 띄운다.
// 휴대폰 폭이거나 로그인·회원가입 같은 인증 화면이면 false 를 돌려주고, 호출부가 원래대로
// 로그인 페이지로 보낸다.
export const OPEN_LOGIN_MODAL_EVENT = 'marie:open-login-modal';

const DESKTOP_QUERY = '(min-width: 768px)';
// 따로 서 있는 인증 화면 — 여기서는 창 대신 로그인 페이지로 이동하는 게 자연스럽다.
const FULL_PAGE_PATHS = ['/login', '/signup', '/onboarding', '/banned'];

export interface OpenLoginModalDetail {
  /** 로그인 후 돌아올 경로. 없으면 지금 보던 페이지. */
  redirect?: string;
}

export function canUseLoginModal(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const onAuthScreen = path.startsWith('/auth/') || FULL_PAGE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  return !onAuthScreen && window.matchMedia(DESKTOP_QUERY).matches;
}

/** 로그인 창을 띄웠으면 true. false 면 호출부가 로그인 페이지로 이동시킨다. */
export function openLoginModal(redirect?: string): boolean {
  if (!canUseLoginModal()) return false;
  window.dispatchEvent(new CustomEvent<OpenLoginModalDetail>(OPEN_LOGIN_MODAL_EVENT, { detail: { redirect } }));
  return true;
}

// 로그인 창이 가로챈 링크 클릭 — 페이지 이동 진행바(NavigationProgress)가 이동으로 오해하지 않게 표시한다.
const handledClicks = new WeakSet<Event>();

export function markLoginModalClick(e: Event): void {
  handledClicks.add(e);
}

export function isLoginModalClick(e: Event): boolean {
  return handledClicks.has(e);
}
