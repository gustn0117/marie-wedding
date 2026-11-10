'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { appHaptic, isAppTabRoot, takeAppBackNavigation, type AppHapticStyle } from '@/shared/utils/appShell';
import { isLoginModalClick } from '@/shared/utils/loginModal';

/**
 * 앱 화면의 손맛 — iOS 앱(<html data-app>)에서만 움직이고, 브라우저에서는 아무것도 하지 않는다.
 *
 * 1) 누름: 버튼·링크·카드를 누르면 살짝 눌렸다가 떼는 순간 스프링처럼 돌아오고 짧게 진동한다.
 *    작은 버튼이든 큰 카드든 같은 깊이(PRESS_DEPTH_PX)로 눌리도록 크기에 맞춰 줄인다.
 *    스크롤하려고 댄 손가락(곧바로 움직임)은 누름으로 치지 않는다.
 * 2) 화면 이동: 위쪽 진행 막대 대신, 누른 링크가 다음 화면이 그려질 때까지 눌린 채로 있다가
 *    새 화면이 오른쪽에서 밀려 들어온다. 탭끼리는 짧게 겹쳐 바뀌고, 앱 뒤로 버튼은 왼쪽에서 들어온다.
 *    손가락으로 밀어 뒤로 가기는 iOS 가 직접 움직이므로 손대지 않는다.
 *
 * 모양(눌림 크기·스프링·들어오기)은 globals.css 의 '앱 누름·화면 이동' 절.
 */

const PRESSABLE = [
  'a[href]',
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'label',
  'summary',
  '[data-pressable]',
].join(',');
const SELECTION_HAPTIC = 'label, [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"]';

const ACTIVATE_DELAY_MS = 45; // 이 안에 손가락이 움직이면 스크롤로 본다
const MOVE_TOLERANCE_PX = 8;
const TAP_HOLD_MS = 90; // 짧게 톡 쳐도 눌림이 보이도록 잠깐 유지
const PENDING_MAX_MS = 2000; // 다음 화면을 기다리며 눌린 채로 두는 최대 시간
const RELEASE_CLEANUP_MS = 500; // globals.css 의 되돌아오는 시간(0.45s)보다 조금 길게
const PRESS_DEPTH_PX = 7;
const MAX_SHRINK = 0.06;
const ENTER_CLASSES = ['app-enter-push', 'app-enter-back', 'app-enter-tab'] as const;

// 서버에서 그릴 때 useLayoutEffect 경고가 나지 않게
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function isAppDocument(): boolean {
  return document.documentElement.hasAttribute('data-app');
}

function closestFrom<T extends Element = HTMLElement>(target: EventTarget | null, selector: string): T | null {
  return target instanceof Element ? target.closest<T>(selector) : null;
}

function isDisabled(el: HTMLElement): boolean {
  return (
    (el as HTMLButtonElement).disabled === true ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.closest('[data-no-press], fieldset:disabled') !== null
  );
}

function hapticFor(el: HTMLElement): AppHapticStyle | null {
  const marked = el.closest<HTMLElement>('[data-haptic]')?.dataset.haptic;
  if (marked === 'none') return null;
  if (marked) return marked as AppHapticStyle;
  return el.matches(SELECTION_HAPTIC) ? 'selection' : 'light';
}

function pressDown(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const inline = getComputedStyle(el).display === 'inline';
  // 글 속 링크나 화면을 거의 다 덮는 큰 덩어리는 크기 대신 옅어지게(줄이면 어색하다)
  if (inline || rect.width === 0 || rect.height > window.innerHeight * 0.6) {
    el.dataset.pressKind = 'fade';
    el.style.removeProperty('--press-scale');
  } else {
    const shrink = Math.min(MAX_SHRINK, PRESS_DEPTH_PX / Math.max(rect.width, rect.height));
    el.style.setProperty('--press-scale', (1 - shrink).toFixed(3));
    delete el.dataset.pressKind;
  }
  el.dataset.press = 'down';
}

function pressUp(el: HTMLElement): void {
  if (el.dataset.press !== 'down') return;
  el.dataset.press = 'up';
  window.setTimeout(() => {
    if (el.dataset.press !== 'up') return;
    delete el.dataset.press;
    delete el.dataset.pressKind;
    el.style.removeProperty('--press-scale');
  }, RELEASE_CLEANUP_MS);
}

/** 이 클릭이 다른 화면으로 옮기는 링크인지(같은 화면의 검색 조건·#앵커 이동은 아니다). */
function isPageNavigation(e: MouseEvent): boolean {
  if (isLoginModalClick(e) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const anchor = closestFrom<HTMLAnchorElement>(e.target, 'a[href]');
  if (!anchor || anchor.hasAttribute('download')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

export default function AppTouchFeedback() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const popAtRef = useRef(0);
  const pendingRef = useRef<{ el: HTMLElement; timer: number } | null>(null);
  const enterTokenRef = useRef(0);

  // 누름 — 문서 전체에 한 번만 건다
  useEffect(() => {
    if (!isAppDocument()) return;

    let press: { el: HTMLElement; pointerId: number; x: number; y: number; active: boolean; timer: number | null } | null =
      null;

    const releasePending = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      window.clearTimeout(pending.timer);
      pendingRef.current = null;
      pressUp(pending.el);
    };

    const cancel = () => {
      if (!press) return;
      if (press.timer !== null) window.clearTimeout(press.timer);
      if (press.active) pressUp(press.el);
      press = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button > 0) return;
      cancel();
      releasePending();
      const el = closestFrom(e.target, PRESSABLE);
      if (!el || isDisabled(el)) return;
      const current = { el, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false, timer: null as number | null };
      current.timer = window.setTimeout(
        () => {
          current.timer = null;
          current.active = true;
          pressDown(el);
        },
        e.pointerType === 'mouse' ? 0 : ACTIVATE_DELAY_MS,
      );
      press = current;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.pointerId) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE_PX) cancel();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.pointerId) return;
      const { el } = press;
      if (press.timer !== null) window.clearTimeout(press.timer);
      if (!press.active) pressDown(el);
      press = null;
      const haptic = hapticFor(el);
      if (haptic) appHaptic(haptic);
      // 화면을 옮기는 클릭이면 onClick 이 눌린 채로 붙잡는다. 아니면 잠깐 뒤 놓는다.
      window.setTimeout(() => {
        if (pendingRef.current?.el !== el) pressUp(el);
      }, TAP_HOLD_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (!isPageNavigation(e)) return;
      const el = closestFrom(e.target, PRESSABLE);
      if (!el || el.dataset.press !== 'down') return;
      releasePending();
      pendingRef.current = { el, timer: window.setTimeout(releasePending, PENDING_MAX_MS) };
    };

    const onPopState = () => {
      popAtRef.current = Date.now();
    };

    const onHide = () => {
      cancel();
      releasePending();
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true, capture: true });
    document.addEventListener('pointercancel', cancel, { passive: true, capture: true });
    // 클릭은 React(Next 링크)가 처리한 뒤에 본다 — 기본 동작을 막았어도 화면 이동일 수 있다
    window.addEventListener('click', onClick);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      document.removeEventListener('pointermove', onPointerMove, { capture: true });
      document.removeEventListener('pointerup', onPointerUp, { capture: true });
      document.removeEventListener('pointercancel', cancel, { capture: true });
      window.removeEventListener('click', onClick);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      onHide();
    };
  }, []);

  // 화면 이동 — 새 화면을 그리기 직전에 들어오는 움직임을 건다
  useIsomorphicLayoutEffect(() => {
    if (!isAppDocument()) return;
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    const pending = pendingRef.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingRef.current = null;
      pressUp(pending.el);
    }
    if (prev === null || prev === pathname) return;

    const viaBackButton = takeAppBackNavigation();
    const viaGesture = !viaBackButton && Date.now() - popAtRef.current < 1000;
    popAtRef.current = 0;
    if (viaGesture) return; // 손가락으로 밀어 뒤로·앞으로 — iOS 가 이미 화면을 밀어 준다

    const kind = viaBackButton
      ? 'app-enter-back'
      : isAppTabRoot(prev) && isAppTabRoot(pathname)
        ? 'app-enter-tab'
        : 'app-enter-push';
    const main = document.querySelector('main');
    if (!main) return;
    const token = ++enterTokenRef.current;
    main.classList.remove(...ENTER_CLASSES);
    main.getBoundingClientRect(); // 같은 움직임을 처음부터 다시 시작하게 한 번 배치를 확정한다
    main.classList.add(kind);
    const finish = (event?: AnimationEvent) => {
      if (event && event.target !== main) return; // 안쪽 요소의 움직임이 끝난 것은 무시
      main.removeEventListener('animationend', finish);
      // 그새 다음 화면으로 넘어가 새 움직임을 걸었으면 그것을 지우지 않는다
      if (token === enterTokenRef.current) main.classList.remove(kind);
    };
    main.addEventListener('animationend', finish);
    window.setTimeout(() => finish(), 600);
  }, [pathname]);

  return null;
}
