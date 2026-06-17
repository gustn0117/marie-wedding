/**
 * 클라이언트에서 mutation 후 호출. 지정된 경로들의 서버 캐시 무효화.
 * fire-and-forget — 실패해도 mutation 흐름 막지 않음.
 */
export async function revalidate(...paths: string[]): Promise<void> {
  try {
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
      keepalive: true,
    });
  } catch {
    /* swallow */
  }
}
