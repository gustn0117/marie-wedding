import { after } from 'next/server';
import { SITE_HOST, SITE_URL, absoluteUrl } from '@/shared/seo';

// IndexNow — 새 글·수정·삭제를 검색엔진에 바로 알린다(크롤러가 다시 올 때까지 기다리지 않는다).
// 키 파일은 public/<INDEXNOW_KEY>.txt. 루트에 있어야 사이트 전체 URL 을 제출할 수 있다.
// 네이버에는 직접 보내고, api.indexnow.org 로 보낸 건 빙 등 참여 엔진끼리 공유된다.
// 전체 URL 일괄 제출: scripts/indexnow-submit.mjs
export const INDEXNOW_KEY = '5c0a20999c8e8818226df11773c5c55d';
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINTS = [
  'https://searchadvisor.naver.com/indexnow',
  'https://api.indexnow.org/indexnow',
] as const;

const MAX_URLS_PER_REQUEST = 10_000; // 프로토콜 상한
const REQUEST_TIMEOUT_MS = 8_000;

export interface IndexNowResult {
  endpoint: string;
  status: number | null;
  error?: string;
}

function isOwnUrl(url: string): boolean {
  try {
    return new URL(url).host === SITE_HOST;
  } catch {
    return false;
  }
}

/** URL(또는 경로) 목록을 모든 엔드포인트에 제출한다. 사이트 밖 URL 은 거른다. 200·202 가 성공. */
export async function submitIndexNow(urlsOrPaths: string[]): Promise<IndexNowResult[]> {
  const urls = [...new Set(urlsOrPaths.map((u) => absoluteUrl(u)))].filter(isOwnUrl);
  const results: IndexNowResult[] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    const body = JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls.slice(i, i + MAX_URLS_PER_REQUEST),
    });
    const batch = await Promise.all(
      INDEXNOW_ENDPOINTS.map(async (endpoint): Promise<IndexNowResult> => {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body,
            cache: 'no-store',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          return { endpoint, status: res.status };
        } catch (e) {
          return { endpoint, status: null, error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    results.push(...batch);
  }
  return results;
}

// 연속 저장처럼 같은 URL 을 짧은 간격으로 반복 제출하지 않는다(워커별 메모리 — 최선 노력).
const RECENT_TTL_MS = 60_000;
const recentlySubmitted = new Map<string, number>();

/**
 * 공개 페이지(공고·프로필·행사·커뮤니티 글)가 생성·수정·삭제된 직후 라우트 핸들러에서 호출한다.
 * 응답을 보낸 뒤(after) 제출하므로 API 응답을 늦추지 않고, 실패해도 요청 결과에는 영향이 없다.
 * 운영(production)에서만 동작한다.
 */
export function notifyIndexNow(paths: string | string[]): void {
  if (process.env.NODE_ENV !== 'production' || process.env.INDEXNOW_DISABLED === '1') return;

  const now = Date.now();
  for (const [url, at] of recentlySubmitted) {
    if (now - at > RECENT_TTL_MS) recentlySubmitted.delete(url);
  }
  const urls = (Array.isArray(paths) ? paths : [paths])
    .map((p) => absoluteUrl(p))
    .filter((u) => isOwnUrl(u) && !recentlySubmitted.has(u));
  if (urls.length === 0) return;
  urls.forEach((u) => recentlySubmitted.set(u, now));

  const task = async () => {
    const results = await submitIndexNow(urls);
    const failed = results.filter((r) => r.status === null || r.status >= 400);
    if (failed.length > 0) console.warn('[indexnow] submit failed:', JSON.stringify(failed), urls.join(' '));
  };
  try {
    after(task);
  } catch {
    // 요청 범위 밖(after 사용 불가)에서 불린 경우 — 그냥 백그라운드로 보낸다.
    void task().catch(() => {});
  }
}
