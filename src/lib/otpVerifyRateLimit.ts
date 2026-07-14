import 'server-only';

import { createHash } from 'crypto';

const WINDOW_MS = 60_000;
const IP_MAX = 30;
const TARGET_MAX = 10;
const SEND_IP_MAX = 10;
const SEND_TARGET_MAX = 2;

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) return cloudflareIp;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

function consume(key: string, max: number, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

function sweep(now: number) {
  if (now - lastSweep < 5 * WINDOW_MS) return;
  lastSweep = now;
  const cutoff = now - WINDOW_MS;
  hits.forEach((timestamps, key) => {
    if (timestamps.every((timestamp) => timestamp <= cutoff)) hits.delete(key);
  });
}

/**
 * OTP 검증 endpoint의 짧은 burst를 막는다. 실제 시도 횟수 보안 경계는 DB의
 * row-lock RPC이고, 이 제한기는 단일 프로세스에서 불필요한 DB/인증 호출을 줄인다.
 */
export function consumeOtpVerifyAttempt(
  request: Request,
  scope: 'phone' | 'email-signup' | 'password-reset',
  identifier: string,
): boolean {
  const now = Date.now();
  sweep(now);

  const identifierHash = createHash('sha256').update(identifier).digest('hex');
  const ipAllowed = consume(`verify:ip:${clientIp(request)}`, IP_MAX, now);
  const targetAllowed = consume(`verify:target:${scope}:${identifierHash}`, TARGET_MAX, now);
  return ipAllowed && targetAllowed;
}

/** 외부 SMS/메일 비용 남용을 줄이는 짧은 burst 제한. DB cooldown이 최종 target 경계다. */
export function consumeOtpSendAttempt(
  request: Request,
  scope: 'phone' | 'email-signup' | 'password-reset',
  identifier: string,
): boolean {
  const now = Date.now();
  sweep(now);
  const identifierHash = createHash('sha256').update(identifier).digest('hex');
  const ipAllowed = consume(`send:ip:${clientIp(request)}`, SEND_IP_MAX, now);
  const targetAllowed = consume(`send:target:${scope}:${identifierHash}`, SEND_TARGET_MAX, now);
  return ipAllowed && targetAllowed;
}
