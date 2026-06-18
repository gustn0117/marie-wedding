'use client';

import { useEffect, useState } from 'react';

/**
 * 자체 네이버 OAuth 콜백 처리 중 표시되는 로딩 페이지.
 * (현재는 콜백 라우트가 즉시 redirect하므로 거의 표시되지 않지만,
 *  서버 처리가 늦어질 때 보호용으로 유지.)
 */
export default function AuthProcessingPage() {
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 5000);
    const t2 = setTimeout(() => setStage(2), 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div
          className="mx-auto w-10 h-10 border-2 border-gray-200 border-t-ink rounded-full animate-spin"
          aria-hidden
        />
        <p className="mt-4 text-sm text-gray-700">
          {stage === 0 && '네이버 로그인을 처리하는 중입니다…'}
          {stage === 1 && '조금만 더 기다려주세요…'}
          {stage === 2 && '응답이 늦어지고 있어요.'}
        </p>
        {stage === 2 && (
          <a
            href="/login"
            className="mt-3 inline-block text-xs font-semibold text-primary underline underline-offset-4"
          >
            로그인 페이지로 돌아가기
          </a>
        )}
      </div>
    </main>
  );
}
