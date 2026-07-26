import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { checkBusinessProfileCompleteness } from '@/features/jobs/lib/business-profile-completeness';
import { isUuid } from '@/shared/utils/uuid';
import { sameNullableTimestamp } from '@/shared/utils/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 단계별 timeout 누적을 막기 위해 인증/조회/쓰기 전체가 하나의 deadline을 공유한다.
const WRITE_TIMEOUT_MS = 10_000;

/**
 * 채용 공고 create/update API (service_role).
 * QA-010 재발 방지 — auto_moderate_job + protect_job_admin_cols 트리거 조합 우회.
 *
 * Body:
 *  { mode: 'create', id: UUID, payload: JobFormData }
 *  { mode: 'update', id: string, payload: Partial<JobFormData> }
 */
interface JobPayload {
  title?: string;
  description?: string;
  businessType?: string;
  employmentType?: string;
  region?: string;
  salaryInfo?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryUnit?: 'monthly' | 'yearly' | 'daily' | 'hourly';
  experienceMin?: number | null;
  deadline?: string | null;
  image?: string | null;
  images?: unknown;
}

/**
 * date-only 마감일('YYYY-MM-DD')을 KST 하루 끝(23:59:59+09:00)으로 정규화.
 * DatePicker 가 넘긴 날짜가 UTC 자정(=KST 오전 9시)으로 저장돼
 * 마감일 당일 오전에 조기 마감되던 문제 방지.
 * 이미 시각 정보가 있는 문자열은 그대로 통과시킨다.
 */
const normalizeDeadline = (d?: string | null): string | null =>
  !d ? null : (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59+09:00` : d);

export async function POST(request: Request) {
  const requestSignal = AbortSignal.any([request.signal, AbortSignal.timeout(WRITE_TIMEOUT_MS)]);
  let body: { mode?: 'create' | 'update'; id?: string; payload?: JobPayload };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const mode = body.mode;
  const payload = body.payload ?? {};
  if (mode !== 'create' && mode !== 'update') {
    return NextResponse.json({ error: 'mode 는 create 또는 update' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const { data: me, error: profileError } = await service
    .from('profiles')
    .select('id, role, account_type, company_name, business_type, region, phone, bio, banned_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (profileError) {
    console.error('[jobs/write] requester lookup failed:', profileError);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '프로필 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.banned_at) return NextResponse.json({ error: '제재된 계정은 이용할 수 없습니다.' }, { status: 403 });
  if (me.account_type !== 'business' && me.role !== 'admin') {
    return NextResponse.json({ error: '공고 등록은 업체 회원만 가능합니다.' }, { status: 403 });
  }

  // 급여 범위 · 최소 경력 검증 — INTEGER(int4) 컬럼 초과·역전 방지 (mode 분기 전)
  // null/undefined 는 '미기재' 로 허용. update 는 부분 payload 이므로 값이 실제 전달됐을 때만 검사.
  const MAX_SALARY = 100_000_000;
  for (const key of ['salaryMin', 'salaryMax'] as const) {
    const v = payload[key];
    if (v !== undefined && v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_SALARY)) {
      return NextResponse.json({ error: '급여 범위 값이 올바르지 않습니다.' }, { status: 400 });
    }
  }
  if (payload.salaryMin != null && payload.salaryMax != null && payload.salaryMin > payload.salaryMax) {
    return NextResponse.json({ error: '급여 최소값이 최대값보다 클 수 없습니다.' }, { status: 400 });
  }
  {
    const v = payload.experienceMin;
    if (v !== undefined && v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50)) {
      return NextResponse.json({ error: '최소 경력 값이 올바르지 않습니다.' }, { status: 400 });
    }
  }

  // 추가 사진(갤러리) — 클라이언트가 보낸 storage 경로 목록. 개수·형식을 서버에서 다시 강제한다.
  // 경로만 받으므로 버킷 밖을 가리키거나 상위 경로로 빠져나가는 문자열은 거른다.
  const JOB_IMAGES_MAX = 8;
  let normalizedImages: string[] | null | undefined;
  if (payload.images !== undefined) {
    if (payload.images === null) {
      normalizedImages = null;
    } else if (!Array.isArray(payload.images)) {
      return NextResponse.json({ error: '추가 사진 형식이 올바르지 않습니다.' }, { status: 400 });
    } else {
      const cleaned = payload.images
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length <= 300 && !p.includes('..') && !p.startsWith('/') && !/^https?:/i.test(p));
      if (cleaned.length > JOB_IMAGES_MAX) {
        return NextResponse.json({ error: `추가 사진은 최대 ${JOB_IMAGES_MAX}장까지 가능합니다.` }, { status: 400 });
      }
      normalizedImages = cleaned.length > 0 ? cleaned : null;
    }
  }

  if (mode === 'create') {
    const jobId = body.id?.trim();
    if (!isUuid(jobId)) {
      return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });
    }
    const check = checkBusinessProfileCompleteness(me);
    if (!check.isComplete) {
      const missing = check.missing.map((m) => m.label).join(', ');
      return NextResponse.json({ error: `업체 프로필을 먼저 완성해주세요. 부족한 항목: ${missing}` }, { status: 400 });
    }
    if (!payload.title || !payload.description || !payload.businessType || !payload.employmentType || !payload.region) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
    }
    const createInput = {
      id: jobId,
      author_id: me.id,
      posting_type: 'hiring' as const,
      title: payload.title,
      description: payload.description,
      business_type: payload.businessType,
      employment_type: payload.employmentType,
      region: payload.region,
      salary_info: payload.salaryInfo || null,
      salary_min: payload.salaryMin ?? null,
      salary_max: payload.salaryMax ?? null,
      salary_unit: payload.salaryUnit ?? 'monthly',
      experience_min: payload.experienceMin ?? null,
      deadline: normalizeDeadline(payload.deadline),
      image: payload.image || null,
      images: normalizedImages ?? null,
    };
    // 클라이언트가 폼 생명주기 동안 유지하는 ID를 그대로 INSERT한다. commit 뒤 응답만
    // 유실되어 같은 요청이 재시도돼도 PK 충돌을 성공 replay로 복구할 수 있다.
    const { error: insertErr } = await service.from('jobs').insert(createInput).abortSignal(requestSignal);
    if (insertErr) {
      if (insertErr.code === '23505') {
        const { data: existing, error: replayError } = await service
          .from('jobs')
          .select('id, author_id, posting_type, title, description, business_type, employment_type, region, salary_info, salary_min, salary_max, salary_unit, experience_min, deadline, image, deleted_at')
          .eq('id', jobId)
          .abortSignal(requestSignal)
          .maybeSingle();
        if (replayError) {
          console.error('[jobs/write:create] replay lookup failed:', replayError);
          return NextResponse.json(
            { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '등록 결과를 확인하지 못했습니다.' },
            { status: requestSignal.aborted ? 504 : 500 },
          );
        }
        const sameContext = !!existing
          && existing.author_id === createInput.author_id
          && existing.posting_type === createInput.posting_type
          && !existing.deleted_at;
        const exactReplay = sameContext
          && existing.title === createInput.title
          && existing.description === createInput.description
          && existing.business_type === createInput.business_type
          && existing.employment_type === createInput.employment_type
          && existing.region === createInput.region
          && existing.salary_info === createInput.salary_info
          && existing.salary_min === createInput.salary_min
          && existing.salary_max === createInput.salary_max
          && existing.salary_unit === createInput.salary_unit
          && existing.experience_min === createInput.experience_min
          && sameNullableTimestamp(existing.deadline, createInput.deadline)
          && existing.image === createInput.image;
        if (exactReplay) {
          return NextResponse.json({ success: true, job: { id: jobId }, replayed: true });
        }
        if (sameContext) {
          return NextResponse.json({
            error: '같은 생성 ID로 이미 다른 내용의 공고가 등록되었습니다. 기존에 생성된 공고를 확인한 뒤 해당 항목을 수정해주세요.',
          }, { status: 409 });
        }
        if (
          existing
          && existing.author_id === createInput.author_id
          && existing.posting_type === createInput.posting_type
        ) {
          return NextResponse.json({ error: '이미 삭제된 생성 요청입니다. 새 작성 화면에서 다시 등록해주세요.' }, { status: 409 });
        }
        return NextResponse.json({ error: '이미 사용된 생성 ID입니다.' }, { status: 409 });
      }
      console.error('[jobs/write:create] failed:', insertErr);
      return NextResponse.json(
        { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : `등록에 실패했습니다: ${insertErr.message}` },
        { status: requestSignal.aborted ? 504 : 500 },
      );
    }
    return NextResponse.json({ success: true, job: { id: jobId } });
  }

  // update
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
  const { data: existing, error: existingError } = await service
    .from('jobs')
    .select('id, author_id, deleted_at')
    .eq('id', id)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (existingError) {
    console.error('[jobs/write:update] existing lookup failed:', existingError);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : '공고 정보를 확인하지 못했습니다.' },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!existing) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  if (existing.deleted_at) return NextResponse.json({ error: '이미 삭제된 공고입니다.' }, { status: 410 });
  const canManage = me.id === existing.author_id || me.role === 'admin';
  if (!canManage) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.businessType !== undefined) updateData.business_type = payload.businessType;
  if (payload.employmentType !== undefined) updateData.employment_type = payload.employmentType;
  if (payload.region !== undefined) updateData.region = payload.region;
  if (payload.salaryInfo !== undefined) updateData.salary_info = payload.salaryInfo || null;
  if (payload.salaryMin !== undefined) updateData.salary_min = payload.salaryMin;
  if (payload.salaryMax !== undefined) updateData.salary_max = payload.salaryMax;
  if (payload.salaryUnit !== undefined) updateData.salary_unit = payload.salaryUnit;
  if (payload.experienceMin !== undefined) updateData.experience_min = payload.experienceMin;
  if (payload.deadline !== undefined) updateData.deadline = normalizeDeadline(payload.deadline);
  if (payload.image !== undefined) updateData.image = payload.image || null;
  if (normalizedImages !== undefined) updateData.images = normalizedImages;

  const { error: updErr } = await service
    .from('jobs')
    .update(updateData)
    .eq('id', id)
    .abortSignal(requestSignal);
  if (updErr) {
    console.error('[jobs/write:update] failed:', updErr);
    return NextResponse.json(
      { error: requestSignal.aborted ? '저장 서버 응답이 지연되고 있습니다. 다시 시도해주세요.' : `수정에 실패했습니다: ${updErr.message}` },
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  return NextResponse.json({ success: true, job: { id } });
}
