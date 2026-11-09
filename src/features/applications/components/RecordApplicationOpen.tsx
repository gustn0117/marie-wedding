'use client';

import { useEffect } from 'react';
import { recordApplicationViews } from '@/features/applications/lib/applicationViews';

/**
 * 지원서 상세를 공고자가 열었음을 기록한다(관리자 지원 현황용). 화면에는 아무것도 그리지 않는다.
 * 뒤에 깔린 탭으로 연 경우엔 탭이 앞으로 올 때 기록한다.
 */
export default function RecordApplicationOpen({ applicationId }: { applicationId: string }) {
  useEffect(() => {
    const record = () => recordApplicationViews([applicationId], 'detail', true);
    if (document.visibilityState === 'visible') {
      record();
      return;
    }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      record();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [applicationId]);

  return null;
}
