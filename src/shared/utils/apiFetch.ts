import { friendlyError } from '@/shared/utils/errorMessages';

/**
 * 내부 API 라우트 호출 전용 fetch — 타임아웃 내장.
 *
 * 배경: self-hosted Supabase + Cloudflare 터널 환경에서 fetch 가 settle 되지 않고
 * 영원히 pending 상태로 남는 경우가 있음. 서비스 레이어의 raw fetch 들이 이 상태에
 * 걸리면 호출측 loading state 가 영구 잠금 → 사용자에겐 '무한 저장 중...' 으로 보임.
 *
 * AbortController 로 기본 15초 후 확실히 reject 시켜 catch/finally 가 항상 실행되게 한다.
 */
export async function apiFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
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
