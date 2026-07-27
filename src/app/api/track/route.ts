import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 자체 방문 측정 수집기.
 *
 * 외부 분석 서비스를 붙이지 않은 이유: 계정·동의배너 없이 오늘 바로 켜야 하고,
 * 데이터가 우리 DB 에 남아야 유입 경로를 직접 따져볼 수 있기 때문이다.
 *
 * 개인정보를 저장하지 않는다 — IP 는 그대로 두지 않고 그날치 소금과 함께 해시해
 * '오늘 서로 다른 방문자 수'만 셀 수 있는 값으로 바꾼다(날이 바뀌면 추적 불가).
 */

const BOT_RE = /bot|crawler|spider|slurp|bingpreview|yeti|facebookexternalhit|embedly|curl|wget|python|go-http|headless|lighthouse|semrush|ahrefs|scan/i;

/** 유입 경로를 사람이 읽을 수 있는 이름으로 묶는다. */
function classifySource(referrerHost: string | null, path: string, query: string): string {
  // 홍보 메일·팩스에는 utm_source 를 붙여 보내면 여기서 정확히 잡힌다.
  const utm = new URLSearchParams(query).get('utm_source');
  if (utm) return utm.toLowerCase().slice(0, 40);
  if (!referrerHost) return 'direct'; // 주소 직접 입력·메일 클릭(추적 파라미터 없을 때)
  if (/(^|\.)google\./.test(referrerHost)) return 'google';
  if (/(^|\.)naver\./.test(referrerHost)) return 'naver';
  if (/(^|\.)daum\.|(^|\.)kakao\./.test(referrerHost)) return 'daum';
  if (/(^|\.)bing\./.test(referrerHost)) return 'bing';
  if (/instagram|facebook|threads/.test(referrerHost)) return 'sns';
  if (referrerHost.endsWith('marie.co.kr')) return 'internal';
  void path;
  return referrerHost.slice(0, 60);
}

function deviceOf(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawPath = typeof body.path === 'string' ? body.path : '';
    if (!rawPath.startsWith('/')) return NextResponse.json({ ok: true });

    // 쿼리는 분류에만 쓰고 저장은 경로만 한다(검색어 등이 그대로 쌓이지 않게).
    const [path, query = ''] = rawPath.split('?');
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : '';
    let referrerHost: string | null = null;
    try { referrerHost = referrer ? new URL(referrer).hostname.toLowerCase() : null; } catch { referrerHost = null; }

    const ua = request.headers.get('user-agent') ?? '';
    const isBot = BOT_RE.test(ua) || ua.length === 0;

    // 방문자 식별 — IP+UA 를 날짜별 소금과 해시. 원본은 저장하지 않는다.
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || request.headers.get('cf-connecting-ip') || '';
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash('sha256')
      .update(`${ip}|${ua}|${day}|${process.env.OTP_HASH_SALT ?? 'marie'}`)
      .digest('hex')
      .slice(0, 16);

    const supabase = createServiceClient();
    await supabase.from('page_views').insert({
      path: path.slice(0, 300),
      referrer: referrer || null,
      referrer_host: referrerHost,
      source: classifySource(referrerHost, path, query),
      device: deviceOf(ua),
      visitor,
      is_bot: isBot,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // 측정 실패가 사용자 화면에 영향을 주면 안 된다.
    console.error('[api/track] failed:', e);
    return NextResponse.json({ ok: true });
  }
}
