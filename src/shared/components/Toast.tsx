'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, opts?: { duration?: number }) => void;
  success: (message: string, opts?: { duration?: number }) => void;
  error: (message: string, opts?: { duration?: number }) => void;
  info: (message: string, opts?: { duration?: number }) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastApi | null>(null);

let externalShow: ((message: string, kind?: ToastKind, opts?: { duration?: number }) => void) | null = null;
let externalConfirm: ((message: string) => Promise<boolean>) | null = null;

export function toast(message: string, kind: ToastKind = 'info', opts?: { duration?: number }) {
  if (externalShow) externalShow(message, kind, opts);
  else if (typeof window !== 'undefined') window.alert(message);
}

export function toastConfirm(message: string): Promise<boolean> {
  if (externalConfirm) return externalConfirm(message);
  if (typeof window !== 'undefined') return Promise.resolve(window.confirm(message));
  return Promise.resolve(false);
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{ message: string; resolve: (b: boolean) => void } | null>(null);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'info', opts?: { duration?: number }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = opts?.duration ?? 3500;
    setItems((prev) => [...prev, { id, kind, message, duration }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
  }, [remove]);

  const confirmFn = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const api: ToastApi = {
    show,
    success: (m, o) => show(m, 'success', o),
    error: (m, o) => show(m, 'error', o),
    info: (m, o) => show(m, 'info', o),
    confirm: confirmFn,
  };

  useEffect(() => {
    externalShow = show;
    externalConfirm = confirmFn;
    return () => { externalShow = null; externalConfirm = null; };
  }, [show, confirmFn]);

  function resolveConfirm(answer: boolean) {
    if (confirmState) confirmState.resolve(answer);
    setConfirmState(null);
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-3 pb-4 sm:items-end sm:right-4 sm:pb-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded border shadow-sm ${
              t.kind === 'success'
                ? 'border-primary bg-primary text-white'
                : t.kind === 'error'
                  ? 'border-state-urgent bg-white text-state-urgent'
                  : 'border-gray-300 bg-white text-gray-900'
            }`}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <span aria-hidden className="text-sm font-bold">
                {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'ⓘ'}
              </span>
              <p className="flex-1 text-sm font-semibold leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="text-xs opacity-60 hover:opacity-100"
                aria-label="알림 닫기"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm border border-gray-200 bg-white p-5 shadow-xl">
            <p className="text-sm text-gray-900 whitespace-pre-wrap mb-5 leading-relaxed">{confirmState.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className="rounded border border-primary bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
