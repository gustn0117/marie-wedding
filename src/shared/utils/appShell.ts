/**
 * 마리에 iOS 앱(mobile/)은 이 사이트를 앱 화면(웹뷰)에 그대로 띄우는 껍데기다.
 * 앱은 사용자 에이전트 끝에 표시를 붙이고(mobile/capacitor.config.ts 의 appendUserAgent),
 * <head> 의 감지 스크립트가 그것을 보고 <html data-app="ios"> 를 단다.
 * 앱 전용 모양(상태 표시줄 자리 비우기, 아래 탭, 바닥글 숨김, 애플 로그인)은 모두 이 속성에 건 CSS 라
 * 서버 렌더링과 캐시는 브라우저·앱이 같다(globals.css 의 '앱 화면' 절).
 */
export const APP_USER_AGENT_MARK = 'MarieApp-iOS';

/** 아래 탭이 보이는 첫 화면. 그 밖의 화면(상세·글쓰기·로그인 등)은 탭 대신 머리글에 뒤로 버튼이 보인다. */
export const APP_TAB_ROOTS = ['/', '/jobs', '/directory', '/community', '/mypage'] as const;

export function isAppTabRoot(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (APP_TAB_ROOTS as readonly string[]).includes(path);
}

/** 앱 안에서 열린 화면인지(브라우저에서 부를 때만 의미가 있다). */
export function isAppShell(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute('data-app');
}

// --- 앱 기능 부르기 -------------------------------------------------------------------------
// 사이트는 Capacitor 라이브러리를 싣지 않는다. 앱이 웹뷰에 심는 window.Capacitor.Plugins 를 바로 쓴다
// (mobile/ios/App/App/MainViewController.swift 에서 등록한 플러그인과 @capacitor/* 플러그인).

type PluginMethod = (options?: Record<string, unknown>) => Promise<unknown>;
type CapacitorGlobal = { Plugins?: Record<string, Record<string, PluginMethod | undefined> | undefined> };

function appPlugin(name: string) {
  if (!isAppShell()) return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.Plugins?.[name] ?? null;
}

/**
 * 앱 상태 표시줄 글자색. 'dark' = 검은 글자(흰 머리글 위, 기본), 'light' = 흰 글자(남색 메뉴·사진 보기 위).
 * 브라우저에서는 아무것도 하지 않는다.
 */
export function setAppStatusBarText(tone: 'dark' | 'light'): void {
  const setStyle = appPlugin('StatusBar')?.setStyle;
  // Capacitor 의 DARK = 어두운 바탕용(흰 글자), LIGHT = 밝은 바탕용(검은 글자)
  setStyle?.({ style: tone === 'light' ? 'DARK' : 'LIGHT' }).catch(() => undefined);
}

/**
 * 인쇄(‘PDF로 저장’ 포함). 앱 웹뷰에서는 window.print() 가 아무 일도 하지 않으므로 iOS 인쇄 창을 띄운다.
 * 인쇄용 CSS(@media print)는 그대로 적용된다.
 */
export function printPage(): void {
  const nativePrint = appPlugin('MarieShell')?.printPage;
  if (nativePrint) {
    nativePrint().catch(() => window.print());
    return;
  }
  window.print();
}

export type AppHapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'soft'
  | 'rigid'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

/**
 * 앱 진동(햅틱, mobile/ios/App/App/LinkRouting.swift 의 MarieShell.haptic).
 * 브라우저이거나 진동 기능이 없는 예전 앱(1.0 빌드 1)에서는 아무것도 하지 않는다.
 */
export function appHaptic(style: AppHapticStyle = 'light'): void {
  const haptic = appPlugin('MarieShell')?.haptic;
  if (typeof haptic !== 'function') return;
  haptic({ style }).catch(() => undefined);
}

// 화면 이동 방향 — 앱 뒤로 버튼이 표시해 두면 AppTouchFeedback 이 새 화면을 반대쪽(왼쪽)에서 들인다.
// 표시만 남고 화면이 안 바뀌는 경우(같은 주소로 돌아감)에 엉뚱한 이동이 쓰지 않도록 잠깐만 유효하다.
let backNavigationMarkedAt = 0;
const BACK_MARK_TTL_MS = 1500;

export function markAppBackNavigation(): void {
  backNavigationMarkedAt = Date.now();
}

/** 방금 앱 뒤로 버튼으로 이동했는지 — 한 번 읽으면 지운다. */
export function takeAppBackNavigation(): boolean {
  const marked = Date.now() - backNavigationMarkedAt < BACK_MARK_TTL_MS;
  backNavigationMarkedAt = 0;
  return marked;
}

export interface AppleAuthorization {
  identityToken: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
}

/** 애플 로그인 창을 띄울 수 있는 앱인지 — 앱 안이고 애플 로그인 플러그인이 실려 있을 때만. */
export function canSignInWithApple(): boolean {
  return typeof appPlugin('AppleSignIn')?.authorize === 'function';
}

/**
 * 애플 로그인 창을 띄운다(mobile/ios/App/App/AppleSignInPlugin.swift). 취소하면 code 'CANCELED' 로 거절된다.
 * nonce 는 원래 값을 넘긴다 — 앱이 SHA-256 으로 바꿔 애플에 보내고, 서버는 원래 값으로 토큰을 확인한다.
 */
export async function authorizeWithApple(nonce: string): Promise<AppleAuthorization> {
  const authorize = appPlugin('AppleSignIn')?.authorize;
  if (!authorize) throw Object.assign(new Error('Apple 로그인을 쓸 수 없습니다.'), { code: 'UNAVAILABLE' });
  return (await authorize({ nonce })) as AppleAuthorization;
}

/**
 * <head> 맨 앞에 그대로 넣는 감지 스크립트. 그리기 전에 돌아야 앱 모양이 처음부터 맞게 나온다.
 * data-app-tabbar 는 첫 화면이 탭 화면인지 — 이후 화면 이동은 AppTabBar 가 고친다.
 */
export const APP_SHELL_DETECT_SCRIPT = `(function(){try{if(navigator.userAgent.indexOf(${JSON.stringify(
  APP_USER_AGENT_MARK,
)})===-1)return;var d=document.documentElement;d.setAttribute('data-app','ios');var p=location.pathname.replace(/\\/+$/,'')||'/';if(${JSON.stringify(
  APP_TAB_ROOTS,
)}.indexOf(p)!==-1)d.setAttribute('data-app-tabbar','');}catch(e){}})();`;
