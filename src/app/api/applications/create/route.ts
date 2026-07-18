import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { SUPABASE_SCHEMA } from '@/lib/supabase/schema';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { isUuid } from '@/shared/utils/uuid';
import { isValidResumePhone } from '@/features/resumes/types';
import { readBoundedJson } from '@/lib/bounded-json';
import { notifyEmployerOfApplication } from '@/features/notifications/lib/applicationNotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 5_000;
const MAX_PHONE_LENGTH = 40;

interface CreateApplicationBody {
  applicationId?: unknown;
  jobId?: unknown;
  resumeId?: unknown;
  message?: unknown;
  contactPhone?: unknown;
}

function rpcErrorResponse(message: string, timedOut: boolean) {
  const normalized = message.toLowerCase();
  if (timedOut) {
    return NextResponse.json(
      { error: '접수 처리 시간이 초과되었습니다. 접수 내역을 확인한 뒤 다시 시도해주세요.' },
      { status: 504 },
    );
  }
  if (normalized.includes('already_applied') || normalized.includes('duplicate')) {
    return NextResponse.json({ error: '이미 접수된 내역이 있습니다.' }, { status: 409 });
  }
  if (normalized.includes('resume_incomplete') || normalized.includes('resume_name_required')) {
    return NextResponse.json({ error: '이력서 완성도를 60% 이상으로 채워주세요.' }, { status: 422 });
  }
  if (normalized.includes('resume_not_found')) {
    return NextResponse.json({ error: '선택한 이력서를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (
    normalized.includes('job_not_found')
    || normalized.includes('job_closed')
    || normalized.includes('job_expired')
    || normalized.includes('job_not_open')
    || normalized.includes('job_author_unavailable')
  ) {
    return NextResponse.json({ error: '더 이상 지원할 수 없는 공고입니다.' }, { status: 409 });
  }
  if (
    normalized.includes('individual_only')
    || normalized.includes('individual_account_required')
    || normalized.includes('not_individual')
    || normalized.includes('self_application')
    || normalized.includes('cannot_apply_to_own_job')
    || normalized.includes('not_onboarded')
    || normalized.includes('onboarding_required')
    || normalized.includes('banned')
    || normalized.includes('forbidden')
  ) {
    return NextResponse.json({ error: '이 공고에 지원할 수 없습니다.' }, { status: 403 });
  }
  if (normalized.includes('unauthorized')) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (normalized.includes('contact_phone_required')) {
    return NextResponse.json({ error: '연락받을 휴대폰 번호를 확인해주세요.' }, { status: 400 });
  }
  if (normalized.includes('application_id_conflict')) {
    return NextResponse.json({ error: '접수 정보가 충돌했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.' }, { status: 409 });
  }
  if (normalized.includes('pgrst202') || normalized.includes('could not find the function')) {
    return NextResponse.json({ error: '지원 서버가 준비 중입니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ error: '접수를 처리하지 못했습니다.' }, { status: 500 });
}

/**
 * 이력서 지원 접수.
 *
 * 브라우저가 전송한 지원자 ID나 snapshot은 신뢰하지 않는다. 인증된
 * auth.uid()를 사용하는 submit_application_with_resume RPC가 개인 회원·공고·이력서
 * 소유권을 검증하고 application과 불변 snapshot을 한 트랜잭션에서 생성한다.
 */
export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const boundedBody = await readBoundedJson(request, MAX_REQUEST_BYTES);
  if (!boundedBody.ok) {
    return NextResponse.json(
      { error: boundedBody.reason === 'too_large' ? '지원 정보가 너무 큽니다.' : '잘못된 요청입니다.' },
      { status: boundedBody.reason === 'too_large' ? 413 : 400 },
    );
  }
  const rawBody = boundedBody.value;
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const body = rawBody as CreateApplicationBody;

  const applicationId = typeof body.applicationId === 'string' ? body.applicationId.trim() : '';
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  const resumeId = typeof body.resumeId === 'string' ? body.resumeId.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : '';

  if (!isUuid(applicationId) || !isUuid(jobId) || !isUuid(resumeId)) {
    return NextResponse.json({ error: '지원 정보를 확인해주세요.' }, { status: 400 });
  }
  if (message.length < 10 || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `지원 내용을 10자 이상 ${MAX_MESSAGE_LENGTH.toLocaleString()}자 이하로 입력해주세요.` },
      { status: 400 },
    );
  }
  if (contactPhone.length > MAX_PHONE_LENGTH || (contactPhone && !isValidResumePhone(contactPhone))) {
    return NextResponse.json({ error: '연락처 형식을 확인해주세요.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: SUPABASE_SCHEMA },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, requestSignal])
            : requestSignal,
        }),
      },
      cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );

  const { data: { user }, error: authError } = await ssr.auth.getUser();
  if (authError && requestSignal.aborted) {
    return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 });
  }
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await ssr
    .rpc('submit_application_with_resume', {
      p_application_id: applicationId,
      p_job_id: jobId,
      p_resume_id: resumeId,
      p_message: message,
      p_contact_phone: contactPhone || null,
    })
    .abortSignal(requestSignal);

  if (error) return rpcErrorResponse(error.message, requestSignal.aborted);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return NextResponse.json({ error: '접수 결과를 확인하지 못했습니다.' }, { status: 500 });
  }

  // 지원자 응답에는 업체의 비공개 메모(author_note)를 절대 포함하지 않는다.
  const safeApplication = { ...(row as Record<string, unknown>) };
  delete safeApplication.author_note;

  // 채용자에게 새 지원자 알림 이메일 — 서버(지속 실행 Node)에서 백그라운드로 발송한다.
  // await 하면 자체 SMTP 가 느릴 때 '지원하기' 응답이 그만큼 지연되므로 기다리지 않고
  // 즉시 응답한다. 프로세스가 살아있어 발송은 백그라운드로 완주한다(best-effort).
  const notifyJobId = typeof safeApplication.job_id === 'string' ? safeApplication.job_id : jobId;
  const notifyApplicantId = typeof safeApplication.applicant_id === 'string' ? safeApplication.applicant_id : '';
  if (notifyApplicantId) {
    void notifyEmployerOfApplication(notifyJobId, notifyApplicantId).catch((e) => {
      console.error('[applications/create] employer notify failed (non-fatal):', e);
    });
  }

  return NextResponse.json({ data: safeApplication });
}
