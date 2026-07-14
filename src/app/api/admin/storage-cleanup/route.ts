import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { cleanupStorageOrphans } from '@/lib/storage-orphan-cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLEANUP_TIMEOUT_MS = 55_000;
const INTERNAL_TOKEN_CONTEXT = 'marie-storage-orphan-cleanup-v1';

let activeCleanup: Promise<Awaited<ReturnType<typeof cleanupStorageOrphans>>> | null = null;

class CleanupInProgressError extends Error {
  constructor() {
    super('이미 Storage 정리 작업이 실행 중입니다. 잠시 후 다시 확인해 주세요.');
    this.name = 'CleanupInProgressError';
  }
}

function expectedInternalToken(): string | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;
  return createHmac('sha256', serviceRoleKey).update(INTERNAL_TOKEN_CONTEXT).digest('hex');
}

function hasInternalAuthorization(request: Request): boolean {
  const header = request.headers.get('authorization');
  const provided = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const expected = expectedInternalToken();
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length
    && timingSafeEqual(providedBytes, expectedBytes);
}

async function authorize(request: Request, signal: AbortSignal): Promise<boolean> {
  return hasInternalAuthorization(request) || isAdminRequest(signal);
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

async function runCleanup({
  dryRun,
  minAgeHours,
  maxDeletes,
  signal,
}: {
  dryRun: boolean;
  minAgeHours?: number;
  maxDeletes?: number;
  signal: AbortSignal;
}) {
  // 서로 다른 dry-run/삭제 요청이 같은 Promise를 공유하면 GET이 삭제 작업에 합류할
  // 수 있다. 실행 중 요청에는 명시적으로 409를 돌려 모드 경계를 보존한다.
  if (activeCleanup) throw new CleanupInProgressError();
  const task = cleanupStorageOrphans({ dryRun, minAgeHours, maxDeletes, signal });
  activeCleanup = task;
  try {
    return await task;
  } finally {
    if (activeCleanup === task) activeCleanup = null;
  }
}

/** 관리자 화면/운영 점검용 read-only 미리보기. */
export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(CLEANUP_TIMEOUT_MS)]);
  if (!await authorize(request, signal)) {
    return NextResponse.json(
      { error: signal.aborted ? 'Storage 점검 시간이 초과되었습니다.' : '관리자 권한이 필요합니다.' },
      { status: signal.aborted ? 504 : 403 },
    );
  }

  const search = new URL(request.url).searchParams;
  try {
    const result = await runCleanup({
      dryRun: true,
      minAgeHours: parsePositiveNumber(search.get('minAgeHours')),
      maxDeletes: parsePositiveNumber(search.get('maxDeletes')),
      signal,
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = signal.aborted
      ? 'Storage 점검 시간이 초과되었습니다.'
      : error instanceof Error ? error.message : 'Storage 점검에 실패했습니다.';
    return NextResponse.json(
      { error: message },
      { status: signal.aborted ? 504 : error instanceof CleanupInProgressError ? 409 : 500 },
    );
  }
}

/**
 * 기본값은 dry-run이다. 실제 삭제는 명시적으로 { dryRun: false }를 보내야 한다.
 * 컨테이너 내부 스케줄러는 service-role로 파생한 HMAC token을 사용한다.
 */
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(CLEANUP_TIMEOUT_MS)]);
  const internal = hasInternalAuthorization(request);
  if (!internal && !await isAdminRequest(signal)) {
    return NextResponse.json(
      { error: signal.aborted ? 'Storage 정리 시간이 초과되었습니다.' : '관리자 권한이 필요합니다.' },
      { status: signal.aborted ? 504 : 403 },
    );
  }

  const body = await request.json().catch(() => null) as {
    dryRun?: unknown;
    minAgeHours?: unknown;
    maxDeletes?: unknown;
  } | null;
  if (!body || (body.dryRun !== undefined && typeof body.dryRun !== 'boolean')) {
    return NextResponse.json({ error: '잘못된 정리 요청입니다.' }, { status: 400 });
  }

  try {
    const result = await runCleanup({
      dryRun: body.dryRun !== false,
      minAgeHours: parsePositiveNumber(body.minAgeHours),
      maxDeletes: parsePositiveNumber(body.maxDeletes),
      signal,
    });
    const status = result.errors.length > 0 ? 207 : 200;
    return NextResponse.json({ ...result, internal }, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = signal.aborted
      ? 'Storage 정리 시간이 초과되었습니다. 다음 실행에서 이어서 처리합니다.'
      : error instanceof Error ? error.message : 'Storage 정리에 실패했습니다.';
    return NextResponse.json(
      { error: message },
      { status: signal.aborted ? 504 : error instanceof CleanupInProgressError ? 409 : 500 },
    );
  }
}
