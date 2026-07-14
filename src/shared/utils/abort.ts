export interface AbortScope {
  readonly signal: AbortSignal;
  readonly timedOut: boolean;
  dispose: () => void;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('요청이 취소되었습니다.', 'AbortError');
}

/**
 * AbortSignal.any/timeout을 지원하지 않는 iOS·구형 WebView에서도 동작하는
 * 취소 신호 조합기. 호출자는 작업이 끝나면 dispose()로 listener/timer를 정리한다.
 */
export function createAbortScope(
  signals: Array<AbortSignal | null | undefined>,
  timeoutMs?: number,
): AbortScope {
  const controller = new AbortController();
  const listeners: Array<{ signal: AbortSignal; listener: () => void }> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const dispose = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    for (const { signal, listener } of listeners.splice(0)) {
      signal.removeEventListener('abort', listener);
    }
  };

  const abort = (reason: unknown) => {
    if (controller.signal.aborted) return;
    controller.abort(reason);
    dispose();
  };

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      abort(abortReason(signal));
      break;
    }
    const listener = () => abort(abortReason(signal));
    listeners.push({ signal, listener });
    signal.addEventListener('abort', listener, { once: true });
  }

  if (!controller.signal.aborted && timeoutMs !== undefined) {
    timer = setTimeout(() => {
      timedOut = true;
      abort(new DOMException('요청 시간이 초과되었습니다.', 'TimeoutError'));
    }, Math.max(0, timeoutMs));
  }

  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    dispose,
  };
}

/** fetch 하나가 끝날 때 자동으로 listener를 정리하며 두 취소 신호를 합친다. */
export async function fetchWithAbortSignals(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  signal: AbortSignal,
): Promise<Response> {
  const scope = createAbortScope([init?.signal, signal]);
  try {
    return await fetch(input, { ...init, signal: scope.signal });
  } finally {
    scope.dispose();
  }
}
