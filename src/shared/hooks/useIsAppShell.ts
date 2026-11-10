'use client';

import { useEffect, useState } from 'react';
import { isAppShell } from '@/shared/utils/appShell';

/**
 * 앱(iOS 껍데기) 안인지 — 첫 그리기(서버와 같은 화면)는 false, 붙은 뒤에 실제 값으로 바뀐다.
 * 보이는 모양은 CSS(html[data-app])로 나누고, 이 값은 '동작'(아래 선택 창 / 펼침 패널 등)을 나눌 때만 쓴다.
 */
export function useIsAppShell(): boolean {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => {
    setIsApp(isAppShell());
  }, []);
  return isApp;
}
