'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { observeApplicationSeen } from '@/features/applications/lib/applicationViews';

/**
 * 받은 지원 카드 감싸개 — 카드가 공고자 화면에 실제로 보이면 '목록 확인'을 기록한다(관리자 지원 현황용).
 * 공고자에게만 보이는 목록(공고 페이지 지원자 파이프라인, 마이페이지 받은 지원)에서만 쓴다.
 */
export default function ApplicationSeenTracker({
  applicationId,
  as: Tag = 'div',
  className,
  children,
}: {
  applicationId: string;
  as?: 'div' | 'article';
  className?: string;
  children: ReactNode;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const setElement = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    return observeApplicationSeen(element, applicationId);
  }, [applicationId]);

  return (
    <Tag ref={setElement} className={className}>
      {children}
    </Tag>
  );
}
