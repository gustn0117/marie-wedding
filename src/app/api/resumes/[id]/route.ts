import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { mapResumeRow, RESUME_SELECT_COLUMNS, resumeContentToRow } from '@/features/resumes/lib/mapper';
import { parseResumeInput } from '@/features/resumes/lib/validation';
import { readBoundedJson } from '@/lib/bounded-json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REQUEST_BYTES = 256 * 1024;
// RFC 4122 UUID (8-4-4-4-12). 이전 패턴은 4번째 그룹이 누락돼 모든 정상 UUID를
// 거부 → 이력서 저장/삭제가 '잘못된 이력서 ID'로 전부 실패했음.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Context { params: Promise<{ id: string }> }

async function authenticate(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  return { signal, caller };
}

function callerError(reason: string) {
  if (reason === 'timeout') return NextResponse.json({ error: '인증 서버 응답이 지연되고 있습니다.' }, { status: 504 });
  if (reason === 'server_error') return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}

function accessError(caller: Extract<Awaited<ReturnType<typeof getVerifiedProfile>>, { ok: true }>) {
  if (caller.accountType !== 'individual') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!caller.onboardedAt) return NextResponse.json({ error: '회원 정보를 먼저 입력해주세요.' }, { status: 403 });
  if (caller.bannedAt) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  return null;
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: '잘못된 이력서 ID입니다.' }, { status: 400 });
  const { signal, caller } = await authenticate(request);
  if (!caller.ok) return callerError(caller.reason);
  const denied = accessError(caller);
  if (denied) return denied;

  const { data, error } = await createServiceClient(signal)
    .from('resumes')
    .select(RESUME_SELECT_COLUMNS)
    .eq('id', id)
    .eq('profile_id', caller.profileId)
    .is('deleted_at', null)
    .abortSignal(signal)
    .maybeSingle();
  if (error) return NextResponse.json({ error: '이력서를 불러오지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  if (!data) return NextResponse.json({ error: '이력서를 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ resume: mapResumeRow(data as unknown as Record<string, unknown>) });
}

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: '잘못된 이력서 ID입니다.' }, { status: 400 });
  const { signal, caller } = await authenticate(request);
  if (!caller.ok) return callerError(caller.reason);
  const denied = accessError(caller);
  if (denied) return denied;

  const body = await readBoundedJson(request, MAX_REQUEST_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === 'too_large' ? '이력서 데이터가 너무 큽니다.' : '잘못된 요청입니다.' },
      { status: body.reason === 'too_large' ? 413 : 400 },
    );
  }
  const raw = body.value;
  let parsed;
  try { parsed = parseResumeInput(raw, caller.userId); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '이력서 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (parsed.content.photoPath) {
    const parts = parsed.content.photoPath.split('/');
    const filename = parts.pop()!;
    const folder = parts.join('/');
    const { data: objects, error: storageError } = await createServiceClient(signal)
      .storage
      .from('resume-files')
      .list(folder, { limit: 10, search: filename });
    if (storageError) {
      console.error('[resumes] photo lookup failed:', storageError.message);
      return NextResponse.json({ error: '이력서 사진을 확인하지 못했습니다.' }, { status: 503 });
    }
    if (!(objects ?? []).some((object) => object.name === filename)) {
      return NextResponse.json({ error: '올린 이력서 사진을 찾을 수 없습니다. 사진을 다시 선택해주세요.' }, { status: 400 });
    }
  }
  const expectedVersion = typeof (raw as Record<string, unknown>).version === 'number'
    ? (raw as Record<string, unknown>).version as number
    : null;
  if (!Number.isInteger(expectedVersion) || expectedVersion! < 1) {
    return NextResponse.json({ error: '이력서 버전이 올바르지 않습니다. 새로고침 후 다시 시도해주세요.' }, { status: 400 });
  }

  const query = createServiceClient(signal)
    .from('resumes')
    .update(resumeContentToRow(parsed.content, parsed))
    .eq('id', id)
    .eq('profile_id', caller.profileId)
    .eq('version', expectedVersion)
    .is('deleted_at', null)
    .select(RESUME_SELECT_COLUMNS);
  const { data, error } = await query.abortSignal(signal).maybeSingle();
  if (error) {
    console.error('[resumes] update failed:', error.message);
    return NextResponse.json({ error: '이력서를 저장하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  if (!data) {
    const { data: existing } = await createServiceClient(signal).from('resumes').select('id').eq('id', id).eq('profile_id', caller.profileId).is('deleted_at', null).maybeSingle();
    return NextResponse.json(
      { error: existing ? '다른 화면에서 이력서가 변경되었습니다. 새로고침 후 다시 저장해주세요.' : '이력서를 찾을 수 없습니다.' },
      { status: existing ? 409 : 404 },
    );
  }
  return NextResponse.json({ resume: mapResumeRow(data as unknown as Record<string, unknown>) });
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: '잘못된 이력서 ID입니다.' }, { status: 400 });
  const expectedVersion = Number(new URL(request.url).searchParams.get('version'));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return NextResponse.json({ error: '이력서 버전이 올바르지 않습니다. 새로고침 후 다시 시도해주세요.' }, { status: 400 });
  }
  const { signal, caller } = await authenticate(request);
  if (!caller.ok) return callerError(caller.reason);
  const denied = accessError(caller);
  if (denied) return denied;

  const { data, error } = await createServiceClient(signal)
    .from('resumes')
    // 제출본은 별도 snapshot에 유지한다. 사용자가 삭제한 편집용 원본에는
    // 복구 가능한 개인정보가 남지 않도록 즉시 비식별화한다.
    .update({
      title: '삭제된 이력서',
      full_name: '',
      email: null,
      phone: null,
      birth_date: null,
      address: null,
      photo_path: null,
      headline: null,
      summary: null,
      desired_roles: [],
      desired_regions: [],
      desired_employment_types: [],
      skills: [],
      educations: [],
      experiences: [],
      certificates: [],
      languages: [],
      links: [],
      completeness_score: 0,
      last_used_at: null,
      deleted_at: new Date().toISOString(),
      is_default: false,
    })
    .eq('id', id)
    .eq('profile_id', caller.profileId)
    .eq('version', expectedVersion)
    .is('deleted_at', null)
    .select('id')
    .abortSignal(signal)
    .maybeSingle();
  if (error) return NextResponse.json({ error: '이력서를 삭제하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  if (!data) {
    const { data: existing } = await createServiceClient(signal)
      .from('resumes')
      .select('id')
      .eq('id', id)
      .eq('profile_id', caller.profileId)
      .is('deleted_at', null)
      .maybeSingle();
    return NextResponse.json(
      { error: existing ? '다른 화면에서 이력서가 변경되었습니다. 새로고침 후 다시 삭제해주세요.' : '이력서를 찾을 수 없습니다.' },
      { status: existing ? 409 : 404 },
    );
  }

  // 기본 이력서를 삭제하면 DB가 남은 문서 하나를 즉시 대표로 승격한다.
  // 승격 결과를 함께 반환해 새로고침 없이도 좌측 목록과 선택 상태를 맞춘다.
  const { data: remainingRows, error: listError } = await createServiceClient(signal)
    .from('resumes')
    .select(RESUME_SELECT_COLUMNS)
    .eq('profile_id', caller.profileId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
    .abortSignal(signal);
  if (listError) {
    console.error('[resumes] post-delete list failed:', listError.message);
    return NextResponse.json({ success: true, resumes: null });
  }
  return NextResponse.json({
    success: true,
    resumes: (remainingRows ?? []).map((row) => mapResumeRow(row as unknown as Record<string, unknown>)),
  });
}
