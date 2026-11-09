import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { isCanonicalResumeAttachmentPath, isCanonicalResumePhotoPath } from '@/features/resumes/lib/photo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'resume-files';

/**
 * 관리자 지원 현황 — 제출 이력서의 사진·포트폴리오(PDF) 열람.
 * 일반 경로(/api/resumes/photo·attachment)는 공고자·지원자 본인만 열 수 있어서 관리자 세션 전용으로 따로 둔다.
 * 이력서 파일 경로 형식({userId}/resume/…, {userId}/portfolio/….pdf)만 허용한다.
 */
export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return new NextResponse(null, { status: 401 });

  const path = new URL(request.url).searchParams.get('path') ?? '';
  const isPhoto = isCanonicalResumePhotoPath(path);
  const isAttachment = !isPhoto && isCanonicalResumeAttachmentPath(path);
  if (!isPhoto && !isAttachment) return new NextResponse(null, { status: 404 });

  const signal = AbortSignal.timeout(15_000);
  try {
    const { data, error } = await createServiceClient(signal).storage.from(BUCKET).download(path);
    if (error || !data) return new NextResponse(null, { status: 404 });
    return new Response(data, {
      headers: {
        'Content-Type': isAttachment ? 'application/pdf' : data.type || 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[api/admin/applications/file] read failed:', error);
    return new NextResponse(null, { status: signal.aborted ? 504 : 404 });
  }
}
