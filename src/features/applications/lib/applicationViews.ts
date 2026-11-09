'use client';

import { apiFetch } from '@/shared/utils/apiFetch';

/**
 * 공고자 확인 기록(클라이언트) — 공고 작성자 화면에서 받은 지원이 '실제로 보였을 때'만 서버에 알린다.
 *  · 목록: 카드가 화면에 절반 이상(또는 충분한 높이로) 보이고, 탭이 앞에 떠 있을 때
 *  · 상세: 지원서 상세 화면이 앞에 떠 있을 때
 * 같은 지원은 10분 안에 다시 보내지 않고, 1초씩 모아 한 번에 보낸다. 실패해도 화면엔 영향이 없다.
 * 서버(/api/applications/viewed)가 본인 공고의 지원인지 다시 확인하므로 여기서는 권한을 따지지 않는다.
 */

export type ApplicationViewSource = 'list' | 'detail';

const RESEND_AFTER_MS = 10 * 60 * 1000;
const FLUSH_DELAY_MS = 1_000;
const MAX_BATCH = 100;

const lastSent = new Map<string, number>();
const pending: Record<ApplicationViewSource, Set<string>> = { list: new Set(), detail: new Set() };
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadHooked = false;

function send(source: ApplicationViewSource, ids: string[]) {
  for (let i = 0; i < ids.length; i += MAX_BATCH) {
    const chunk = ids.slice(i, i + MAX_BATCH);
    void apiFetch('/api/applications/viewed', {
      method: 'POST',
      credentials: 'include',
      // 화면을 떠나는 순간에 보내도 끊기지 않게
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationIds: chunk, source }),
    }, 8_000).catch(() => {});
  }
}

export function flushApplicationViews() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  (Object.keys(pending) as ApplicationViewSource[]).forEach((source) => {
    if (pending[source].size === 0) return;
    const ids = [...pending[source]];
    pending[source].clear();
    send(source, ids);
  });
}

export function recordApplicationViews(ids: string[], source: ApplicationViewSource, immediate = false) {
  const now = Date.now();
  for (const id of ids) {
    const key = `${source}:${id}`;
    const previous = lastSent.get(key);
    if (previous !== undefined && now - previous < RESEND_AFTER_MS) continue;
    lastSent.set(key, now);
    pending[source].add(id);
  }
  if (pending.list.size + pending.detail.size === 0) return;
  if (!unloadHooked && typeof window !== 'undefined') {
    unloadHooked = true;
    window.addEventListener('pagehide', flushApplicationViews);
  }
  if (immediate) {
    flushApplicationViews();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushApplicationViews, FLUSH_DELAY_MS);
  }
}

// ── 목록 카드 관찰 ──────────────────────────────────────────────────────────

const targets = new Map<Element, string>();
let observer: IntersectionObserver | null = null;
let visibilityHooked = false;

function isVisibleEnough(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false;
  // 화면보다 긴 카드는 절반이 보일 수 없으므로 일정 높이 이상 보이면 본 것으로 친다.
  return entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= 160;
}

function getObserver(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null;
  observer = new IntersectionObserver((entries) => {
    // 뒤에 깔린 탭에서 보인 것은 본 것이 아니다 — 탭이 앞으로 오면 다시 확인한다.
    if (document.visibilityState !== 'visible') return;
    const seen: string[] = [];
    for (const entry of entries) {
      if (!isVisibleEnough(entry)) continue;
      const id = targets.get(entry.target);
      if (!id) continue;
      seen.push(id);
      observer?.unobserve(entry.target);
      targets.delete(entry.target);
    }
    if (seen.length > 0) recordApplicationViews(seen, 'list');
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  if (!visibilityHooked) {
    visibilityHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !observer) return;
      // 관찰을 다시 걸면 브라우저가 현재 보이는 상태로 콜백을 한 번 더 준다.
      for (const element of targets.keys()) {
        observer.unobserve(element);
        observer.observe(element);
      }
    });
  }
  return observer;
}

/** 받은 지원 카드가 화면에 보이면 '목록 확인'으로 기록한다. 반환값은 관찰 해제 함수. */
export function observeApplicationSeen(element: Element, applicationId: string): () => void {
  const io = getObserver();
  if (!io) {
    recordApplicationViews([applicationId], 'list');
    return () => {};
  }
  targets.set(element, applicationId);
  io.observe(element);
  return () => {
    io.unobserve(element);
    targets.delete(element);
  };
}
