'use client';

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useIsAppShell } from '@/shared/hooks/useIsAppShell';

const CLOSE_MS = 220;
const DRAG_CLOSE_PX = 90;

interface AppSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  doneLabel?: string;
}

/**
 * 아래에서 올라오는 선택 창(iOS 시트). 뒤를 어둡게 덮고, 바깥을 누르거나 손잡이를 끌어내리면 닫힌다.
 * <body> 로 옮겨 그려 부모의 transform·overflow 영향을 받지 않는다.
 * [data-app-sheet] — 바깥 클릭 감지(useOutsideClick)·당겨서 새로고침이 이 안의 손동작은 건드리지 않는다.
 */
export default function AppSheet({ open, title, onClose, children, doneLabel = '완료' }: AppSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  // 열 때 바로 그리고, 닫을 때는 내려가는 움직임이 끝난 뒤 지운다
  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      setDrag(0);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
      setDrag(0);
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  // 열린 동안 뒤 화면이 같이 스크롤되지 않게 + ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onHandleStart = (e: TouchEvent) => {
    dragStartRef.current = e.touches[0]?.clientY ?? null;
  };
  const onHandleMove = (e: TouchEvent) => {
    if (dragStartRef.current === null) return;
    const dy = (e.touches[0]?.clientY ?? dragStartRef.current) - dragStartRef.current;
    setDrag(Math.max(0, dy));
  };
  const onHandleEnd = () => {
    if (dragStartRef.current === null) return;
    dragStartRef.current = null;
    if (drag > DRAG_CLOSE_PX) onCloseRef.current();
    else setDrag(0);
  };

  if (!mounted || !rendered) return null;

  return createPortal(
    <div data-app-sheet className="fixed inset-0 z-modal">
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 ${closing ? 'app-sheet-fade-out' : 'app-fade-in'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-[20px] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(19,22,29,0.12)] ${
          closing ? 'app-sheet-down' : 'app-sheet-up'
        }`}
        style={drag > 0 ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        {/* 손잡이 + 제목 줄 — 여기를 끌어내리면 닫힌다 */}
        <div
          className="shrink-0 touch-none"
          onTouchStart={onHandleStart}
          onTouchMove={onHandleMove}
          onTouchEnd={onHandleEnd}
          onTouchCancel={onHandleEnd}
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-gray-300" />
          <div className="flex h-12 items-center justify-between px-5">
            <h2 className="text-[17px] font-bold text-ink">{title}</h2>
            <button type="button" onClick={onClose} className="-mr-2 h-11 px-2 text-[16px] font-semibold text-primary">
              {doneLabel}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 웹에서는 그 자리에 펼치는 패널, 앱에서는 아래에서 올라오는 선택 창 — 같은 내용·같은 동작을 그대로 쓴다.
 */
export function AdaptivePanel({
  open,
  title,
  onClose,
  className,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const isApp = useIsAppShell();
  if (isApp) {
    return (
      <AppSheet open={open} title={title} onClose={onClose}>
        <div className="app-sheet-body">{children}</div>
      </AppSheet>
    );
  }
  return open ? <div className={className}>{children}</div> : null;
}
