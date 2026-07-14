import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { isCanonicalResumePhotoPath } from '@/features/resumes/lib/photo';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'resume-files';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_FILE_BYTES = 768 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 128 * 1024;
const SNAPSHOT_AUTH_PAGE_SIZE = 100;
const MAX_IMAGE_DIMENSION = 4_096;
const MAX_IMAGE_PIXELS = 16_000_000;

async function cleanupUpload(path: string): Promise<void> {
  await createServiceClient(AbortSignal.timeout(4_000))
    .storage
    .from(BUCKET)
    .remove([path])
    .catch(() => undefined);
}

function authError(reason: string) {
  if (reason === 'timeout') return NextResponse.json({ error: '인증 시간이 초과되었습니다.' }, { status: 504 });
  if (reason === 'server_error') return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < end && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function uint16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function uint32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function uint24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = uint16be(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrame.has(marker) && segmentLength >= 7) {
      return { height: uint16be(bytes, offset + 3), width: uint16be(bytes, offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(bytes, 12, 16);
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  if (
    chunk === 'VP8 '
    && bytes.length >= 30
    && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a
  ) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

async function inspectImage(file: Blob): Promise<{
  extension: 'jpg' | 'png' | 'webp';
  contentType: string;
  width: number;
  height: number;
} | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const dimensions = jpegDimensions(bytes);
    return dimensions ? { extension: 'jpg', contentType: 'image/jpeg', ...dimensions } : null;
  }
  if (
    bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    && ascii(bytes, 12, 16) === 'IHDR'
  ) {
    return { extension: 'png', contentType: 'image/png', width: uint32be(bytes, 16), height: uint32be(bytes, 20) };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    const dimensions = webpDimensions(bytes);
    return dimensions ? { extension: 'webp', contentType: 'image/webp', ...dimensions } : null;
  }
  return null;
}

async function canReadPhoto(
  path: string,
  profileId: string,
  signal: AbortSignal,
): Promise<boolean> {
  const service = createServiceClient(signal);
  const { data: ownedResume, error: resumeError } = await service
    .from('resumes')
    .select('id')
    .eq('profile_id', profileId)
    .eq('photo_path', path)
    .is('deleted_at', null)
    .limit(1)
    .abortSignal(signal)
    .maybeSingle();
  if (resumeError) throw resumeError;
  if (ownedResume) return true;

  // 동일 사진이 많은 지원서에 재사용되어도 앞 100건에 포함된 당사자만
  // 허용되는 일이 없도록, 고정된 순서로 모든 연결 지원서를 나눠 확인한다.
  for (let offset = 0; ; offset += SNAPSHOT_AUTH_PAGE_SIZE) {
    const { data: snapshotRows, error: snapshotError } = await service
      .from('application_resume_snapshots')
      .select('application_id')
      .eq('photo_path', path)
      .order('application_id', { ascending: true })
      .range(offset, offset + SNAPSHOT_AUTH_PAGE_SIZE - 1)
      .abortSignal(signal);
    if (snapshotError) throw snapshotError;
    const applicationIds = (snapshotRows ?? []).map((row) => row.application_id).filter(Boolean);
    if (applicationIds.length === 0) return false;

    const { data: applications, error: applicationsError } = await service
      .from('applications')
      .select('id, applicant_id, job_id')
      .in('id', applicationIds)
      .is('deleted_at', null)
      .abortSignal(signal);
    if (applicationsError) throw applicationsError;
    if ((applications ?? []).some((application) => application.applicant_id === profileId)) return true;

    const jobIds = Array.from(new Set((applications ?? []).map((application) => application.job_id).filter(Boolean)));
    if (jobIds.length > 0) {
      const { data: jobs, error: jobsError } = await service
        .from('jobs')
        .select('id')
        .in('id', jobIds)
        .eq('author_id', profileId)
        .limit(1)
        .abortSignal(signal);
      if (jobsError) throw jobsError;
      if ((jobs?.length ?? 0) > 0) return true;
    }

    if (applicationIds.length < SNAPSHOT_AUTH_PAGE_SIZE) return false;
  }
}

/** 비공개 이력서 사진 업로드. 브라우저에는 Storage 쓰기 권한을 주지 않는다. */
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  if (caller.accountType !== 'individual' || !caller.onboardedAt || caller.bannedAt) {
    return NextResponse.json({ error: '이력서 사진을 올릴 권한이 없습니다.' }, { status: 403 });
  }

  const resumeId = new URL(request.url).searchParams.get('resumeId') ?? '';
  if (!isUuid(resumeId)) return NextResponse.json({ error: '이력서 정보를 확인해주세요.' }, { status: 400 });
  const ownerService = createServiceClient(signal);
  const { data: ownedResume, error: ownerError } = await ownerService
    .from('resumes')
    .select('id')
    .eq('id', resumeId)
    .eq('profile_id', caller.profileId)
    .is('deleted_at', null)
    .abortSignal(signal)
    .maybeSingle();
  if (ownerError || !ownedResume) {
    return NextResponse.json({ error: '이력서를 찾을 수 없습니다.' }, { status: ownerError ? 503 : 404 });
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: '최적화된 사진은 768KB 이하여야 합니다.' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!image || typeof image === 'string' || typeof image.arrayBuffer !== 'function') {
    return NextResponse.json({ error: '사진 파일이 필요합니다.' }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '최적화된 사진은 768KB 이하여야 합니다.' }, { status: 413 });
  }
  const format = await inspectImage(image);
  if (!format) {
    return NextResponse.json({ error: 'JPG, PNG 또는 WebP 사진만 올릴 수 있습니다.' }, { status: 415 });
  }
  if (
    format.width <= 0
    || format.height <= 0
    || format.width > MAX_IMAGE_DIMENSION
    || format.height > MAX_IMAGE_DIMENSION
    || format.width * format.height > MAX_IMAGE_PIXELS
  ) {
    return NextResponse.json({ error: '사진 해상도가 너무 큽니다. 4096px 이하 사진을 사용해주세요.' }, { status: 413 });
  }

  const path = `${caller.userId}/resume/${crypto.randomUUID()}.${format.extension}`;
  const { error } = await ownerService.storage.from(BUCKET).upload(path, image, {
    contentType: format.contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error || signal.aborted) {
    await cleanupUpload(path);
    if (error) console.error('[resume-photo] upload failed:', error.message);
    return NextResponse.json(
      { error: signal.aborted ? '사진 업로드 시간이 초과되었습니다.' : '사진을 올리지 못했습니다.' },
      { status: signal.aborted ? 504 : 502 },
    );
  }
  return NextResponse.json({ path, url: `/api/resumes/photo?path=${encodeURIComponent(path)}` });
}

/** 원본 소유자 또는 해당 지원의 양 당사자에게만 사진을 스트리밍한다. */
export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  if (caller.bannedAt) return new NextResponse(null, { status: 404 });

  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!isCanonicalResumePhotoPath(path)) return new NextResponse(null, { status: 404 });

  try {
    if (!(await canReadPhoto(path, caller.profileId, signal))) {
      return new NextResponse(null, { status: 404 });
    }
    const { data, error } = await createServiceClient(signal).storage.from(BUCKET).download(path);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new Response(data, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[resume-photo] read failed:', error);
    return new NextResponse(null, { status: signal.aborted ? 504 : 404 });
  }
}
