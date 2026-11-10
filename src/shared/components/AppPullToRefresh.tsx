'use client';

import { useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { appHaptic, isAppShell, isAppTabRoot } from '@/shared/utils/appShell';
import { NOTIFICATIONS_UPDATED_EVENT } from '@/features/notifications/services/notification-service';

/** 이만큼(px) 당기면 놓았을 때 새로고침한다 */
const TRIGGER_PX = 64;
const MAX_PULL_PX = 110;
/** 새로고침하는 동안 본문이 내려와 있는 거리 — 그 틈에 도는 표시가 보인다 */
const HOLD_PX = 52;
const MIN_SPIN_MS = 600;
const MAX_SPIN_MS = 6000;
/** 손가락이 이만큼 움직여야 방향을 정한다(가로 넘김·탭과 구분) */
const DECIDE_PX = 6;
const INDICATOR_PX = 28;

/** iOS 스크롤 끝 고무줄과 같은 꼴 — 당길수록 덜 따라온다 */
function rubberBand(distance: number): number {
  const dimension = 300;
  return (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;
}

/**
 * 앱 '당겨서 새로고침' — 탭 화면(홈·채용정보·인재·업체·커뮤니티·마이) 맨 위에서 아래로 당기면
 * 본문이 따라 내려오며 iOS 도는 표시가 나타나고, 충분히 당기면 톡 진동 후 놓을 때 화면 내용을 새로 받는다(router.refresh).
 * 앱은 스크롤 끝 튕김이 꺼져 있어(Capacitor 기본) 맨 위에서 아래로 끄는 손동작을 사이트가 온전히 받는다.
 * 브라우저에서는 아무것도 하지 않는다.
 */
export default function AppPullToRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<(() => void) | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // router.refresh() 의 새 화면이 다 그려지면(전환 대기 해제) 기다리던 새로고침을 끝낸다
  useEffect(() => {
    if (!isPending && doneRef.current) {
      const done = doneRef.current;
      doneRef.current = null;
      done();
    }
  }, [isPending]);

  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator || !isAppShell()) return;

    let tracking = false;
    let decided = false;
    let armed = false;
    let refreshing = false;
    let startX = 0;
    let startY = 0;
    let main: HTMLElement | null = null;

    const place = (pull: number, animate: boolean) => {
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
      if (main) {
        main.style.transition = animate ? `transform 0.35s ${ease}` : 'none';
        main.style.transform = pull > 0 ? `translate3d(0, ${pull}px, 0)` : '';
      }
      // 표시는 본문과 위 막대 사이 틈의 가운데에, 당긴 만큼 진하게·돌며 나타난다
      const progress = Math.min(1, pull / TRIGGER_PX);
      indicator.style.transition = animate ? `transform 0.35s ${ease}, opacity 0.25s ease-out` : 'none';
      indicator.style.opacity = String(progress);
      indicator.style.transform = `translate3d(0, ${Math.max(0, pull / 2 - INDICATOR_PX / 2)}px, 0) rotate(${progress * 270}deg) scale(${0.6 + progress * 0.4})`;
    };

    const finish = () => {
      refreshing = false;
      indicator.classList.remove('is-spinning');
      place(0, true);
      const settled = main;
      window.setTimeout(() => {
        if (settled && !tracking && !refreshing) settled.style.transition = '';
      }, 400);
    };

    const refresh = async () => {
      refreshing = true;
      indicator.classList.add('is-spinning');
      place(HOLD_PX, true);
      const startedAt = Date.now();
      // 화면 밖에서 따로 받는 것들(알림 종 등)도 새로 묻게 한다
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, MAX_SPIN_MS);
        doneRef.current = () => {
          window.clearTimeout(timer);
          resolve();
        };
        startTransition(() => router.refresh());
      });
      const rest = MIN_SPIN_MS - (Date.now() - startedAt);
      if (rest > 0) await new Promise((r) => window.setTimeout(r, rest));
      finish();
    };

    const onStart = (e: TouchEvent) => {
      tracking = false;
      if (refreshing || e.touches.length !== 1) return;
      if (!isAppTabRoot(pathRef.current) || window.scrollY > 0) return;
      // 아래 선택 창·확인 창이 열렸거나(스크롤 잠김) 입력칸을 만지는 중이면 하지 않는다
      if (document.documentElement.style.overflow === 'hidden' || document.body.style.overflow === 'hidden') return;
      const t = e.target;
      if (t instanceof Element && t.closest('[data-app-sheet], [role="dialog"], input, textarea, select, [contenteditable="true"]')) return;
      main = document.querySelector('main');
      if (!main) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      decided = false;
      armed = false;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
        decided = true;
        // 위로 밀거나(내려 읽기) 옆으로 넘기면 새로고침 손동작이 아니다
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
      }
      if (window.scrollY > 0) {
        tracking = false;
        place(0, true);
        return;
      }
      const pull = Math.min(MAX_PULL_PX, rubberBand(Math.max(0, dy - DECIDE_PX)));
      place(pull, false);
      if (!armed && pull >= TRIGGER_PX) {
        armed = true;
        appHaptic('medium');
      } else if (armed && pull < TRIGGER_PX) {
        armed = false;
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!decided) return;
      if (armed) void refresh();
      else place(0, true);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      if (main) {
        main.style.transform = '';
        main.style.transition = '';
      }
    };
  }, [router]);

  // iOS 도는 표시(UIActivityIndicator) 모양 — 8개의 막대가 점점 옅어진다
  return (
    <div ref={indicatorRef} aria-hidden className="app-only app-ptr">
      <svg className="app-ptr-ticks" viewBox="0 0 28 28" width={INDICATOR_PX} height={INDICATOR_PX}>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={i}
            x1="14"
            y1="4.5"
            x2="14"
            y2="9"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity={1 - i * 0.1}
            transform={`rotate(${-i * 45} 14 14)`}
          />
        ))}
      </svg>
    </div>
  );
}
