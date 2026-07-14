import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE_NAME = 'marie_admin_unlock';
export const ADMIN_SESSION_TTL_SECONDS = 24 * 60 * 60;

const TOKEN_VERSION = 'v1';
const CLOCK_SKEW_SECONDS = 60;

function getSigningSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.ADMIN_PASSWORD
    || null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`marie-admin-session:${payload}`, 'utf8')
    .digest('base64url');
}

/** 길이가 다른 문자열도 고정 길이 digest로 바꾼 뒤 timing-safe 비교한다. */
export function timingSafeStringEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function isValidAdminPassword(password?: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  return !!configured && typeof password === 'string' && timingSafeStringEqual(password, configured);
}

/** v1.<issuedAt>.<expiresAt>.<nonce>.<HMAC> */
export function createAdminSessionToken(nowMs = Date.now()): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('관리자 세션 서명 키가 설정되지 않았습니다.');

  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + ADMIN_SESSION_TTL_SECONDS;
  const nonce = randomBytes(18).toString('base64url');
  const payload = `${TOKEN_VERSION}.${issuedAt}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionToken(token?: string | null, nowMs = Date.now()): boolean {
  const secret = getSigningSecret();
  if (!secret || !token || token === '1') return false;

  const parts = token.split('.');
  if (parts.length !== 5) return false;
  const [version, issuedRaw, expiresRaw, nonce, suppliedSignature] = parts;
  if (version !== TOKEN_VERSION || !/^\d+$/.test(issuedRaw) || !/^\d+$/.test(expiresRaw)) return false;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return false;

  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  const now = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) return false;
  if (expiresAt - issuedAt !== ADMIN_SESSION_TTL_SECONDS) return false;
  if (issuedAt > now + CLOCK_SKEW_SECONDS || expiresAt <= now) return false;

  const payload = `${version}.${issuedRaw}.${expiresRaw}.${nonce}`;
  const expectedSignature = sign(payload, secret);
  return timingSafeStringEqual(suppliedSignature, expectedSignature);
}

export async function hasValidAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}
