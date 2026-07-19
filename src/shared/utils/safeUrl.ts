// 사용자 입력 URL 을 <a href>/<img src> 로 렌더할 때 javascript:/data:/vbscript: 등
// 위험 스킴을 차단한다. http/https 절대 URL 만 통과, 그 외엔 undefined(렌더 생략).
export function safeExternalHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  // 스킴 없는 흔한 값(www.naver.com)은 https:// 를 보정해 정상 링크로 살린다.
  // javascript:/data: 등 위험 스킴은 그대로 파싱돼 http/https 아님 → undefined(숨김).
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    if (u.protocol === 'http:' || u.protocol === 'https:') return candidate;
  } catch {
    // 파싱 불가 값은 외부 링크로 취급하지 않는다.
  }
  return undefined;
}
