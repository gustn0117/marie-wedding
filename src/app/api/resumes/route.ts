import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { createEmptyResumeContent } from '@/features/resumes/types';
import { mapResumeRow, RESUME_SELECT_COLUMNS, resumeContentToRow } from '@/features/resumes/lib/mapper';
import { calculateResumeCompleteness } from '@/features/resumes/types';
import { readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CREATE_REQUEST_BYTES = 8 * 1024;
const MAX_RESUMES = 5;

function authError(reason: string) {
  if (reason === 'timeout') return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다.' }, { status: 504 });
  if (reason === 'server_error') return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}

function accessError(caller: Extract<Awaited<ReturnType<typeof getVerifiedProfile>>, { ok: true }>) {
  if (caller.accountType !== 'individual') {
    return NextResponse.json({ error: '개인 회원만 이력서를 관리할 수 있습니다.' }, { status: 403 });
  }
  if (!caller.onboardedAt) {
    return NextResponse.json({ error: '회원 정보를 먼저 입력해주세요.' }, { status: 403 });
  }
  if (caller.bannedAt) {
    return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  const denied = accessError(caller);
  if (denied) return denied;

  const { data, error } = await createServiceClient(signal)
    .from('resumes')
    .select(RESUME_SELECT_COLUMNS)
    .eq('profile_id', caller.profileId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .abortSignal(signal);

  if (error) {
    console.error('[resumes] list failed:', error.message);
    return NextResponse.json({ error: signal.aborted ? '이력서 조회 시간이 초과되었습니다.' : '이력서를 불러오지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  return NextResponse.json({ resumes: (data ?? []).map((row) => mapResumeRow(row as unknown as Record<string, unknown>)) });
}

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  const denied = accessError(caller);
  if (denied) return denied;

  const parsedBody = await readBoundedJson(request, MAX_CREATE_REQUEST_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === 'too_large' ? '요청 데이터가 너무 큽니다.' : '잘못된 요청입니다.' },
      { status: parsedBody.reason === 'too_large' ? 413 : 400 },
    );
  }
  if (!parsedBody.value || typeof parsedBody.value !== 'object' || Array.isArray(parsedBody.value)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const body = parsedBody.value as { title?: unknown };
  const requestedTitle = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  const service = createServiceClient(signal);
  const [{ count, error: countError }, { data: profile, error: profileError }] = await Promise.all([
    service.from('resumes').select('id', { count: 'exact', head: true }).eq('profile_id', caller.profileId).is('deleted_at', null).abortSignal(signal),
    service.from('profiles').select('contact_name, phone, address').eq('id', caller.profileId).is('deleted_at', null).abortSignal(signal).maybeSingle(),
  ]);
  if (countError || profileError || !profile) {
    return NextResponse.json({ error: '이력서 기본 정보를 준비하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  if ((count ?? 0) >= MAX_RESUMES) {
    return NextResponse.json({ error: `이력서는 최대 ${MAX_RESUMES}개까지 만들 수 있습니다.` }, { status: 409 });
  }

  const content = createEmptyResumeContent(requestedTitle || ((count ?? 0) === 0 ? '기본 이력서' : `새 이력서 ${(count ?? 0) + 1}`));
  content.fullName = profile.contact_name ?? '';
  content.phone = profile.phone ?? '';
  content.email = caller.email ?? '';
  content.address = profile.address ?? '';
  // 프로필 이미지는 공개 avatars 버킷이므로 민감한 이력서 사진으로 복사하지 않는다.
  // 이력서 전용 사진은 resume-files 비공개 업로드 경로에서 별도로 받는다.
  content.photoPath = null;
  const isDefault = (count ?? 0) === 0;
  const completenessScore = calculateResumeCompleteness(content);

  const { data, error } = await service
    .from('resumes')
    .insert({
      profile_id: caller.profileId,
      ...resumeContentToRow(content, { isDefault, completenessScore }),
    })
    .select(RESUME_SELECT_COLUMNS)
    .abortSignal(signal)
    .single();
  if (error) {
    console.error('[resumes] create failed:', error.message);
    if (error.message.includes('resume_limit_exceeded')) {
      return NextResponse.json({ error: `이력서는 최대 ${MAX_RESUMES}개까지 만들 수 있습니다.` }, { status: 409 });
    }
    return NextResponse.json({ error: '이력서를 만들지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  return NextResponse.json({ resume: mapResumeRow(data as unknown as Record<string, unknown>) }, { status: 201 });
}
