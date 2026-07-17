import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  isValidAdminPassword,
} from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_RESPONSE_MS = 700;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURE_LIMIT = 5;
const IP_BLOCK_MS = 30 * 60 * 1000;
const MAX_TRACKED_IPS = 5_000;
const MAX_REQUEST_BYTES = 4 * 1024;

interface AttemptBucket {
  failures: number;
  inFlight: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastSeenAt: number;
}

interface UnlockRateState {
  byIp: Map<string, AttemptBucket>;
  weakPasswordWarningWritten: boolean;
}

type AttemptResult = 'success' | 'failure' | 'neutral';

const globalWithUnlockRateState = globalThis as typeof globalThis & {
  __marieAdminUnlockRateState?: UnlockRateState;
};

function emptyBucket(now: number): AttemptBucket {
  return { failures: 0, inFlight: 0, windowStartedAt: now, blockedUntil: 0, lastSeenAt: now };
}

const unlockRateState = globalWithUnlockRateState.__marieAdminUnlockRateState ?? {
  byIp: new Map<string, AttemptBucket>(),
  weakPasswordWarningWritten: false,
};
globalWithUnlockRateState.__marieAdminUnlockRateState = unlockRateState;

function refreshBucket(bucket: AttemptBucket, now: number) {
  bucket.lastSeenAt = now;
  if (now >= bucket.blockedUntil && now - bucket.windowStartedAt >= RATE_WINDOW_MS) {
    bucket.failures = 0;
    bucket.windowStartedAt = now;
    bucket.blockedUntil = 0;
  }
}

function requestIpKey(request: Request): string {
  // 운영 nginx가 X-Real-IP를 원격 주소로 덮어쓴다. 직접 실행 환경에서는 아래 헤더/공통 키로 폴백한다.
  const raw = request.headers.get('x-real-ip')
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown';
  return createHash('sha256').update(raw.trim()).digest('base64url').slice(0, 24);
}

function getIpBucket(key: string, now: number): AttemptBucket {
  let bucket = unlockRateState.byIp.get(key);
  if (!bucket) {
    if (unlockRateState.byIp.size >= MAX_TRACKED_IPS) {
      const oldest = Array.from(unlockRateState.byIp.entries())
        .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
        .slice(0, Math.ceil(MAX_TRACKED_IPS * 0.1));
      oldest.forEach(([oldKey]) => unlockRateState.byIp.delete(oldKey));
    }
    bucket = emptyBucket(now);
    unlockRateState.byIp.set(key, bucket);
  }
  refreshBucket(bucket, now);
  return bucket;
}

function reserveAttempt(ipBucket: AttemptBucket, now: number): boolean {
  if (now < ipBucket.blockedUntil || ipBucket.failures + ipBucket.inFlight >= IP_FAILURE_LIMIT) {
    // 차단 중 들어오는 요청으로 blockedUntil을 연장하지 않는다. 공격자가 낮은
    // 빈도의 요청만으로 특정 IP를 영구 차단하는 상황을 막는다.
    return false;
  }
  ipBucket.inFlight += 1;
  return true;
}

function finishAttempt(ipBucket: AttemptBucket, result: AttemptResult, now: number) {
  ipBucket.inFlight = Math.max(0, ipBucket.inFlight - 1);
  if (result === 'neutral') return;
  if (result === 'success') {
    // 정상 관리자는 오타 누적으로 잠기지 않게 해당 IP 실패 횟수만 해제한다.
    ipBucket.failures = 0;
    ipBucket.windowStartedAt = now;
    ipBucket.blockedUntil = 0;
    return;
  }
  ipBucket.failures += 1;
  if (ipBucket.failures >= IP_FAILURE_LIMIT && ipBucket.blockedUntil <= now) {
    ipBucket.blockedUntil = now + IP_BLOCK_MS;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function waitForMinimumResponse(startedAt: number) {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // curl/서버 호출은 rate limit과 비밀번호 검증을 그대로 거친다.
  const requestHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    || request.headers.get('host')?.trim();
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

/**
 * 관리자 비밀번호 검증 + 잠금 해제 쿠키 발급.
 * 통과 시 24시간 유효한 HMAC 서명 세션 쿠키를 발급한다.
 */
export async function POST(request: Request) {
  const startedAt = Date.now();
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: '허용되지 않은 요청 출처입니다.' }, { status: 403 });
  }
  if (!contentType.startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON 요청만 허용됩니다.' }, { status: 415 });
  }
  if (!Number.isFinite(contentLength) || contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: '요청 본문이 너무 큽니다.' }, { status: 413 });
  }

  const now = Date.now();
  const ipBucket = getIpBucket(requestIpKey(request), now);
  if (!reserveAttempt(ipBucket, now)) {
    await waitForMinimumResponse(startedAt);
    return NextResponse.json(
      { error: '잠금 해제 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': '1800' } },
    );
  }

  let attemptResult: AttemptResult = 'neutral';
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      attemptResult = 'failure';
      await waitForMinimumResponse(startedAt);
      return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    if (!isPlainObject(rawBody)) {
      attemptResult = 'failure';
      await waitForMinimumResponse(startedAt);
      return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    const configured = process.env.ADMIN_PASSWORD;
    if (!configured) {
      await waitForMinimumResponse(startedAt);
      return NextResponse.json(
        { error: 'ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.' },
        { status: 500 },
      );
    }

    // 운영자 요청으로 짧은 비밀번호를 허용한다. /admin 은 미들웨어상 공개 경로라
    // 이 비밀번호가 유일한 관문이므로, 아래 경고 로그로 약한 설정을 계속 기록만 한다.
    if (configured.length < 16 && !unlockRateState.weakPasswordWarningWritten) {
      unlockRateState.weakPasswordWarningWritten = true;
      console.error('[admin/unlock] ADMIN_PASSWORD는 최소 16자 이상의 무작위 값으로 즉시 교체해야 합니다.');
    }

    const password = typeof rawBody.password === 'string' ? rawBody.password.trim() : '';
    if (!password || !isValidAdminPassword(password)) {
      attemptResult = 'failure';
      await waitForMinimumResponse(startedAt);
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    attemptResult = 'success';

    await waitForMinimumResponse(startedAt);
    return NextResponse.json({ success: true });
  } finally {
    // JSON null 같은 예상 밖 입력이나 쿠키 발급 예외가 발생해도 예약을 반드시
    // 반환한다. inFlight 누수로 관리자 로그인이 영구 잠기는 일을 막는다.
    finishAttempt(ipBucket, attemptResult, Date.now());
  }
}
