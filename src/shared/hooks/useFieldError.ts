'use client';

import { useCallback, useState } from 'react';

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * 폼 필드별 검증 경고 + 누락 필드로 스크롤 이동.
 * 각 검증 대상 필드 컨테이너에 id={`${idPrefix}-${field}`} 를 붙이고, 제출 시
 * 첫 누락 필드에 대해 showFieldIssue({ field, message }) 를 호출하면 그 필드로
 * 부드럽게 스크롤 + 포커스하고 fieldError 로 인라인 경고를 띄운다.
 */
export function useFieldError(idPrefix: string) {
  const [fieldError, setFieldError] = useState<FieldIssue | null>(null);

  const showFieldIssue = useCallback((issue: FieldIssue) => {
    setFieldError(issue);
    requestAnimationFrame(() => {
      const el = document.getElementById(`${idPrefix}-${issue.field}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"], button')?.focus?.();
      }
    });
  }, [idPrefix]);

  const clearFieldError = useCallback(() => setFieldError(null), []);

  return { fieldError, setFieldError, showFieldIssue, clearFieldError };
}
