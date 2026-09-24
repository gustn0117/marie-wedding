#!/usr/bin/env node
// 사이트맵의 모든 URL(또는 인자로 준 URL)을 IndexNow 로 네이버·빙 등에 일괄 색인 요청한다.
//
//   node scripts/indexnow-submit.mjs                 # https://marie.co.kr/sitemap.xml 전체
//   node scripts/indexnow-submit.mjs /about /jobs    # 특정 경로·URL 만
//
// 새 글·수정·삭제는 API 가 자동으로 알린다(src/lib/indexnow.ts). 이 스크립트는 처음 한 번,
// 또는 가이드 추가처럼 여러 페이지가 한꺼번에 바뀌었을 때 쓴다.
// 키는 src/lib/indexnow.ts 의 INDEXNOW_KEY 와 public/<key>.txt 가 같아야 한다.

const SITE_URL = 'https://marie.co.kr';
const HOST = 'marie.co.kr';
const KEY = '5c0a20999c8e8818226df11773c5c55d';
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
const ENDPOINTS = ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow'];

const MEANING = {
  200: '제출 완료',
  202: '접수됨(키 확인 대기)',
  400: '요청 형식 오류',
  403: '키가 유효하지 않음(키 파일 확인)',
  422: '다른 호스트의 URL 이거나 키 불일치',
  429: '요청 과다',
};

async function sitemapUrls() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`sitemap.xml ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

async function main() {
  // 키 파일이 실제로 떠 있어야 검색엔진이 소유를 확인한다.
  const keyRes = await fetch(KEY_LOCATION, { cache: 'no-store' });
  const keyBody = keyRes.ok ? (await keyRes.text()).trim() : '';
  if (keyBody !== KEY) {
    console.error(`키 파일 확인 실패: ${KEY_LOCATION} → ${keyRes.status} ${JSON.stringify(keyBody.slice(0, 60))}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const raw = args.length > 0 ? args : await sitemapUrls();
  const urls = [...new Set(raw.map((u) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`)))]
    .filter((u) => {
      try { return new URL(u).host === HOST; } catch { return false; }
    });
  if (urls.length === 0) {
    console.error('제출할 URL 이 없습니다.');
    process.exit(1);
  }
  console.log(`제출 URL ${urls.length}개`);
  urls.forEach((u) => console.log(`  ${u}`));

  let failed = false;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
        signal: AbortSignal.timeout(20_000),
      });
      const text = (await res.text()).trim();
      const ok = res.status === 200 || res.status === 202;
      if (!ok) failed = true;
      console.log(`${ok ? '✅' : '❌'} ${endpoint} → ${res.status} ${MEANING[res.status] ?? ''}${text ? ` | ${text.slice(0, 300)}` : ''}`);
    } catch (e) {
      failed = true;
      console.log(`❌ ${endpoint} → 요청 실패: ${e instanceof Error ? e.message : e}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main();
