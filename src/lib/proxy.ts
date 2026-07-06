/**
 * Reverse proxy 뒤에서 사용자가 실제 접속한 외부 origin 검출.
 *
 * Cloudflare tunnel / Docker 컨테이너 환경에서는 `new URL(request.url).origin`이
 * 내부 바인딩(`http://0.0.0.0:3000`)을 반환하므로 그대로 redirect Location 에 넣으면
 * Safari가 restricted port 오류(WebKitErrorDomain:103) 로 차단한다.
 *
 * 우선순위:
 *  1. X-Forwarded-Host + X-Forwarded-Proto (proxy 가 set)
 *  2. Host 헤더
 *  3. NEXT_PUBLIC_APP_URL (env)
 *  4. new URL(request.url).origin (최후)
 *
 * 내부 호스트(0.0.0.0, localhost, 127.*, 사설 IP)는 정규식으로 제외.
 */
export function resolveExternalOrigin(request: Request | { headers: Headers; url: string }): string {
  const headers = request.headers;
  const xfHost = headers.get('x-forwarded-host');
  const xfProto = headers.get('x-forwarded-proto');
  if (xfHost && !isInternalHost(xfHost)) {
    return `${xfProto || 'https'}://${xfHost}`;
  }

  const host = headers.get('host');
  if (host && !isInternalHost(host)) {
    return `${xfProto || 'https'}://${host}`;
  }

  const envOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (envOrigin) {
    try {
      const parsed = new URL(envOrigin);
      if (!isInternalHost(parsed.hostname)) return envOrigin.replace(/\/$/, '');
    } catch {}
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return 'https://localhost';
  }
}

function isInternalHost(host: string | null): boolean {
  if (!host) return true;
  // IPv6 localhost or link-local
  if (/^\[?::1\]?/.test(host) || /^\[?fe80:/i.test(host)) return true;
  return /^(0\.0\.0\.0|localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i.test(host);
}
