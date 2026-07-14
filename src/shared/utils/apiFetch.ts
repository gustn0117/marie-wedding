import { friendlyError } from '@/shared/utils/errorMessages';

/**
 * 내부 API 라우트 호출 전용 fetch — 타임아웃 내장.
 *
 * 배경: self-hosted Supabase + Cloudflare 터널 환경에서 fetch 가 settle 되지 않고
 * 영원히 pending 상태로 남는 경우가 있음. 서비스 레이어의 raw fetch 들이 이 상태에
 * 걸리면 호출측 loading state 가 영구 잠금 → 사용자에겐 '무한 저장 중...' 으로 보임.
 *
 * AbortController 로 기본 15초 후 확실히 reject 시켜 catch/finally 가 항상 실행되게 한다.
 * 응답 헤더뿐 아니라 body 전체를 같은 deadline 안에서 읽어 새 Response로 돌려주므로,
 * 서버가 헤더만 보낸 뒤 멈춰도 호출부의 json()/text()가 영구 대기하지 않는다.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  // fetch에는 signal을 하나만 전달할 수 있다. 호출자가 전달한 취소 신호를
  // 공통 타임아웃 신호와 합쳐, 화면 이탈/사용자 취소가 타임아웃에 가려지지 않게 한다.
  const abortFromCaller = () => {
    if (!controller.signal.aborted) controller.abort(callerSignal?.reason);
  };
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timer = setTimeout(() => {
    // 호출자 취소가 먼저 발생했다면 이를 타임아웃으로 잘못 바꾸지 않는다.
    if (!controller.signal.aborted) {
      timedOut = true;
      controller.abort();
    }
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const bytes = await response.arrayBuffer();
    const hasNoBody = init.method?.toUpperCase() === 'HEAD'
      || response.status === 204
      || response.status === 205
      || response.status === 304;
    return new Response(hasNoBody ? null : bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    if (timedOut && controller.signal.aborted) {
      throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * apiFetch + JSON 응답 파싱 + 비정상 status 시 서버 error 메시지로 throw.
 * 서비스 레이어의 공통 패턴(fetch → !ok 시 body.error throw → json 반환)을 한 번에.
 */
export async function apiFetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; fallbackError?: string } = {},
): Promise<T> {
  const { timeoutMs = 15000, fallbackError = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.' } = opts;
  const res = await apiFetch(url, init, timeoutMs);
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(friendlyError(body?.error, fallbackError));
  }
  return (await res.json()) as T;
}
