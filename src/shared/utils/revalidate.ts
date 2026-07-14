/**
 * 클라이언트에서 mutation 후 호출. 지정된 경로들의 서버 캐시 무효화.
 * fire-and-forget — 실패/지연해도 mutation 흐름을 절대 막지 않는다.
 * (일부 호출부가 await 하므로 AbortController 로 반드시 빠르게 settle 되게 한다.)
 */
export async function revalidate(...paths: string[]): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
      keepalive: true,
      signal: controller.signal,
    });
  } catch {
    /* swallow — best-effort */
  } finally {
    clearTimeout(timer);
  }
}
