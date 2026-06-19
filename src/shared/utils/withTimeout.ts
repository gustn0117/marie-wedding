/**
 * 비동기 호출에 timeout 가드를 씌운다.
 *
 * self-hosted Supabase + Cloudflare 터널 환경에서 PostgREST/Storage/OAuth fetch가
 * 영원히 settle 안 되면 finally가 실행되지 않아 setLoading/setSubmitting이 영구 잠금됨.
 * Promise.race로 명확히 reject시켜 catch/finally가 풀리도록 보장한다.
 *
 * 사용:
 *   await withTimeout(supabase.from('x').update(...).select(), 15000);
 *   await withTimeout(supabase.auth.signOut(), 3000, 'signout_timeout');
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(message ?? `요청 시간이 초과되었습니다 (${ms}ms)`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetch 호출용 AbortController + 자동 timeout.
 *
 * 사용:
 *   const { signal, clear } = abortAfter(15000);
 *   try { await fetch(url, { signal }); } finally { clear(); }
 */
export function abortAfter(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}
