// 모바일에서 고해상도 bitmap 두 개 이상이 동시에 디코드되면 탭 메모리 한계에
// 근접한다. 네트워크 병렬성은 유지하되 압축+전송 전체 슬롯을 2개로 제한한다.
const MAX_CONCURRENT_OPTIMIZED_IMAGE_UPLOADS = 2;
const MAX_UPLOAD_QUEUE_WAIT_MS = 30_000;

type ReleaseSlot = () => void;

interface QueuedRequest {
  signal?: AbortSignal;
  resolve: (release: ReleaseSlot) => void;
  reject: (reason: unknown) => void;
  onAbort: () => void;
  settled: boolean;
  waitTimer: ReturnType<typeof setTimeout> | null;
}

let activeCount = 0;
const queue: QueuedRequest[] = [];

function abortedReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException('이미지 업로드가 취소되었습니다.', 'AbortError');
}

function removeAbortListener(request: QueuedRequest): void {
  request.signal?.removeEventListener('abort', request.onAbort);
}

function clearWaitTimer(request: QueuedRequest): void {
  if (request.waitTimer) clearTimeout(request.waitTimer);
  request.waitTimer = null;
}

function releaseFactory(): ReleaseSlot {
  let released = false;
  return () => {
    // finally가 중첩되거나 호출자가 실수로 두 번 해제해도 activeCount가 깨지지 않는다.
    if (released) return;
    released = true;
    activeCount = Math.max(0, activeCount - 1);
    drainQueue();
  };
}

function drainQueue(): void {
  while (activeCount < MAX_CONCURRENT_OPTIMIZED_IMAGE_UPLOADS && queue.length > 0) {
    const request = queue.shift()!;
    if (request.settled) continue;

    if (request.signal?.aborted) {
      request.settled = true;
      removeAbortListener(request);
      clearWaitTimer(request);
      request.reject(abortedReason(request.signal));
      continue;
    }

    request.settled = true;
    removeAbortListener(request);
    clearWaitTimer(request);
    activeCount += 1;
    request.resolve(releaseFactory());
  }
}

function acquireSlot(signal?: AbortSignal): Promise<ReleaseSlot> {
  if (signal?.aborted) return Promise.reject(abortedReason(signal));

  return new Promise<ReleaseSlot>((resolve, reject) => {
    const request: QueuedRequest = {
      signal,
      resolve,
      reject,
      settled: false,
      waitTimer: null,
      onAbort: () => {
        if (request.settled) return;
        request.settled = true;
        const index = queue.indexOf(request);
        if (index >= 0) queue.splice(index, 1);
        removeAbortListener(request);
        clearWaitTimer(request);
        reject(abortedReason(signal));
      },
    };

    signal?.addEventListener('abort', request.onAbort, { once: true });
    request.waitTimer = setTimeout(() => {
      if (request.settled) return;
      request.settled = true;
      const index = queue.indexOf(request);
      if (index >= 0) queue.splice(index, 1);
      removeAbortListener(request);
      clearWaitTimer(request);
      reject(new Error('사진 업로드 대기 시간이 길어 취소했습니다. 잠시 후 다시 시도해주세요.'));
    }, MAX_UPLOAD_QUEUE_WAIT_MS);
    queue.push(request);
    drainQueue();
  });
}

/**
 * 모든 클라이언트 이미지 최적화+전송이 공유하는 FIFO 세마포어.
 *
 * 슬롯을 받은 뒤 실제 작업이 시작되기 전 취소되는 race까지 확인하고, 어떤 종료
 * 경로에서도 슬롯을 정확히 한 번 반환한다. 이 모듈은 다른 업로드 모듈을 import하지
 * 않아 direct/endpoint 양쪽에서 사용해도 런타임 순환 의존성이 생기지 않는다.
 */
export async function withOptimizedImageUploadSlot<T>(
  signal: AbortSignal | undefined,
  task: () => Promise<T>,
): Promise<T> {
  const release = await acquireSlot(signal);
  try {
    if (signal?.aborted) throw abortedReason(signal);
    return await task();
  } finally {
    release();
  }
}
