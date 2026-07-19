'use client';

import { useEffect } from 'react';

/**
 * 미저장 변경이 있을 때(when=true) 탭 닫기·새로고침·외부 이탈 시 브라우저 경고를 띄운다.
 * 긴 본문 작성 폼(공고·게시글·행사·프로필)에서 실수로 이탈해 입력이 통째로 사라지는 것을 막는다.
 *
 * 주의: App Router 의 앱 내부 soft navigation(<Link> 클릭)은 beforeunload 를 발생시키지 않는다.
 * 앱 내부 이동까지 막으려면 취소/이탈 버튼에서 직접 confirm 가드를 두어야 한다.
 */
export function useUnsavedChangesWarning(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome 은 returnValue 설정을 요구
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
