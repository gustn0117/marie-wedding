import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { isCanonicalResumeAttachmentPath } from '@/features/resumes/lib/photo';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'resume-files';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 버킷 한도와 동일(10MB)
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024; // 멀티파트 오버헤드 여유
const SNAPSHOT_AUTH_PAGE_SIZE = 100;

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

/** PDF 매직 바이트(%PDF-) 확인. 확장자·MIME 위조를 막는다. */
function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25 // %
    && bytes[1] === 0x50 // P
    && bytes[2] === 0x44 // D
    && bytes[3] === 0x46 // F
    && bytes[4] === 0x2d; // -
}

/**
 * 첨부 파일을 볼 수 있는 사람: 본인(경로 소유자) 또는 그 첨부가 담긴
 * 지원서의 양 당사자(지원자 본인·공고 작성 업체).
 */
async function canReadAttachment(
  path: string,
  profileId: string,
  userId: string,
  signal: AbortSignal,
): Promise<boolean> {
  // 경로 접두사가 본인 userId면 본인이 올린 파일 — 즉시 허용.
  if (isCanonicalResumeAttachmentPath(path, userId)) return true;

  const service = createServiceClient(signal);
  for (let offset = 0; ; offset += SNAPSHOT_AUTH_PAGE_SIZE) {
    const { data: snapshotRows, error: snapshotError } = await service
      .from('application_resume_snapshots')
      .select('application_id')
      .contains('snapshot', { attachments: [{ path }] })
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

/** 비공개 포트폴리오 PDF 업로드. 브라우저에는 Storage 쓰기 권한을 주지 않는다. */
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  if (caller.accountType !== 'individual' || !caller.onboardedAt || caller.bannedAt) {
    return NextResponse.json({ error: '포트폴리오를 올릴 권한이 없습니다.' }, { status: 403 });
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
    return NextResponse.json({ error: 'PDF 파일은 10MB 이하여야 합니다.' }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'PDF 파일이 필요합니다.' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'PDF 파일은 10MB 이하여야 합니다.' }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) {
    return NextResponse.json({ error: 'PDF 파일만 올릴 수 있습니다.' }, { status: 415 });
  }

  const rawName = typeof form?.get('name') === 'string' ? (form.get('name') as string) : (file.name || '포트폴리오.pdf');
  const name = rawName.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200) || '포트폴리오.pdf';

  const path = `${caller.userId}/portfolio/${crypto.randomUUID()}.pdf`;
  const { error } = await ownerService.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error || signal.aborted) {
    await cleanupUpload(path);
    if (error) console.error('[resume-attachment] upload failed:', error.message);
    return NextResponse.json(
      { error: signal.aborted ? '업로드 시간이 초과되었습니다.' : '파일을 올리지 못했습니다.' },
      { status: signal.aborted ? 504 : 502 },
    );
  }
  return NextResponse.json({
    path,
    name,
    size: file.size,
    url: `/api/resumes/attachment?path=${encodeURIComponent(path)}`,
  });
}

/** 원본 소유자 또는 해당 지원의 양 당사자에게만 PDF를 스트리밍한다. */
export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  if (caller.bannedAt) return new NextResponse(null, { status: 404 });

  const path = new URL(request.url).searchParams.get('path') ?? '';
  if (!isCanonicalResumeAttachmentPath(path)) return new NextResponse(null, { status: 404 });

  try {
    if (!(await canReadAttachment(path, caller.profileId, caller.userId, signal))) {
      return new NextResponse(null, { status: 404 });
    }
    const { data, error } = await createServiceClient(signal).storage.from(BUCKET).download(path);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new Response(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[resume-attachment] read failed:', error);
    return new NextResponse(null, { status: signal.aborted ? 504 : 404 });
  }
}
