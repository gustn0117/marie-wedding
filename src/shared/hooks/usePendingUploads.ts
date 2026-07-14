'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 자식 에디터에서 시작한 업로드를 부모 폼의 저장 흐름에 합류시킨다.
 *
 * 저장 시점에 등록된 작업이 모두 끝날 때까지 기다리고, 기다리는 동안 새 작업이
 * 추가되면 그것까지 합류한다. 실패는 다음 저장 시도에 한 번 전달한다.
 */
export function usePendingUploads() {
  const pendingRef = useRef(new Set<Promise<unknown>>());
  const failureRef = useRef<Error | null>(null);
  const mountedRef = useRef(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const syncPendingCount = useCallback(() => {
    if (mountedRef.current) setPendingCount(pendingRef.current.size);
  }, []);

  const rememberFailure = useCallback((reason: unknown) => {
    // 실패는 다음 저장 시도에서 정확히 한 번 전달한다. 첫 저장이 막힌 뒤에는
    // 사용자가 사진을 다시 추가하거나, 저장을 다시 눌러 이미지 없이 계속할 수 있다.
    if (!failureRef.current) {
      const detail = reason instanceof Error ? reason.message : '알 수 없는 오류';
      failureRef.current = new Error(
        `본문 사진 업로드에 실패했습니다. (${detail}) 사진을 다시 추가하거나 저장 버튼을 한 번 더 눌러 이미지 없이 계속해주세요.`,
      );
    }
  }, []);

  const trackUpload = useCallback((promise: Promise<unknown>) => {
    // 이전 업로드 묶음이 모두 끝난 뒤 사용자가 새 사진을 추가했다면, 그 행동은
    // 실패 복구 시도다. 새 묶음이 성공해도 과거 오류가 첫 저장을 다시 막지 않게 한다.
    if (pendingRef.current.size === 0) {
      failureRef.current = null;
    }
    pendingRef.current.add(promise);
    syncPendingCount();

    // 성공·실패 모두 큐에서 제거한다. reject 핸들러를 함께 등록해 부모가 저장을
    // 누르기 전에 실패한 작업도 unhandled rejection으로 남지 않게 한다.
    void promise.then(
      () => {
        pendingRef.current.delete(promise);
        syncPendingCount();
      },
      (reason) => {
        rememberFailure(reason);
        pendingRef.current.delete(promise);
        syncPendingCount();
      },
    );
  }, [rememberFailure, syncPendingCount]);

  const waitForUploads = useCallback(async () => {
    // 다중 파일 업로드가 앞 작업 완료 후 다음 작업을 등록할 수도 있으므로,
    // 한 번의 snapshot이 아니라 큐가 빌 때까지 확인한다.
    while (pendingRef.current.size > 0) {
      const results = await Promise.allSettled(Array.from(pendingRef.current));
      results.forEach((result) => {
        if (result.status === 'rejected') rememberFailure(result.reason);
      });
    }

    const failure = failureRef.current;
    if (failure) {
      // 같은 실패로 영구 잠기지 않게 한 번 소비한다. 사용자의 다음 저장 클릭은
      // 실패한 이미지가 제거된 현재 본문을 명시적으로 저장하는 동작이 된다.
      failureRef.current = null;
      throw failure;
    }
  }, [rememberFailure]);

  const hasPendingUploads = useCallback(() => pendingRef.current.size > 0, []);

  return { trackUpload, waitForUploads, hasPendingUploads, pendingCount };
}
