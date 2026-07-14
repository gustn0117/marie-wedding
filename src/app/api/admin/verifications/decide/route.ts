import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'verifications';
const REQUEST_TIMEOUT_MS = 10_000;
const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,179}$/i;

function timeoutResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 504 });
}

function storageClient(signal: AbortSignal) {
  return createSbClient(SUPABASE_SERVER_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
      }),
    },
  });
}

/** 비공개 인증 서류의 단기 signed URL을 password-admin 세션으로 발급한다. */
export async function GET(req: NextRequest) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  if (!await isAdminRequest(signal)) {
    return signal.aborted
      ? timeoutResponse('관리자 인증 시간이 초과되었습니다.')
      : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get('path')?.trim() ?? '';
  if (!DOCUMENT_PATH_RE.test(path)) {
    return NextResponse.json({ error: '인증 서류 경로가 올바르지 않습니다.' }, { status: 400 });
  }

  const { data, error } = await storageClient(signal)
    .storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);

  if (signal.aborted) return timeoutResponse('인증 서류를 불러오는 시간이 초과되었습니다.');
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || '인증 서류 URL을 만들지 못했습니다.' }, { status: 502 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl });
}

/** 인증 승인/거절을 password-admin 세션으로 처리한다. */
export async function POST(req: NextRequest) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  if (!await isAdminRequest(signal)) {
    return signal.aborted
      ? timeoutResponse('관리자 인증 시간이 초과되었습니다.')
      : NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    profileId?: unknown;
    decision?: unknown;
    reason?: unknown;
  } | null;
  const profileId = typeof body?.profileId === 'string' ? body.profileId.trim() : '';
  const decision = body?.decision;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!PROFILE_ID_RE.test(profileId) || (decision !== 'verified' && decision !== 'rejected')) {
    return NextResponse.json({ error: '잘못된 인증 처리 요청입니다.' }, { status: 400 });
  }
  if (decision === 'rejected' && !reason) {
    return NextResponse.json({ error: '거절 사유를 입력해 주세요.' }, { status: 400 });
  }
  if (reason.length > 1000) {
    return NextResponse.json({ error: '거절 사유는 1,000자 이하로 입력해 주세요.' }, { status: 400 });
  }

  const adminSb = createServiceClient();
  const { data, error } = await adminSb
    .from('profiles')
    .update({
      verification_status: decision,
      verification_reject_reason: decision === 'rejected' ? reason : null,
    })
    .eq('id', profileId)
    .eq('verification_status', 'pending')
    .is('deleted_at', null)
    .select('id')
    .abortSignal(signal)
    .maybeSingle();

  if (signal.aborted) return timeoutResponse('인증 처리 시간이 초과되었습니다. 상태를 다시 확인해 주세요.');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: '이미 처리되었거나 존재하지 않는 인증 신청입니다.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
