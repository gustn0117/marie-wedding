import { NextResponse } from 'next/server';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { createServiceClient } from '@/lib/supabase/service';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import { isUuid } from '@/shared/utils/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;

interface HiringCursor {
  createdAt: string;
  id: string;
}

function parseCursor(value: string): HiringCursor | null {
  const separator = value.indexOf('|');
  if (separator <= 0 || separator !== value.lastIndexOf('|')) return null;
  const createdAt = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (
    createdAt.length > 64
    || !/^[0-9T:+.\-Z]+$/i.test(createdAt)
    || !Number.isFinite(Date.parse(createdAt))
    || !isUuid(id)
  ) return null;
  return { createdAt, id };
}

function nextCursor(rows: Array<{ id?: unknown; created_at?: unknown }>): string | null {
  if (rows.length < PAGE_SIZE) return null;
  const last = rows.at(-1);
  return typeof last?.id === 'string' && typeof last.created_at === 'string'
    ? `${last.created_at}|${last.id}`
    : null;
}

function authError(reason: string) {
  if (reason === 'timeout') return NextResponse.json({ error: '인증 시간이 초과되었습니다.' }, { status: 504 });
  if (reason === 'server_error') return NextResponse.json({ error: '로그인 정보를 확인하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
}

/**
 * 채용 담당자 전용 지원서 조회.
 *
 * applications.author_note는 브라우저 DB 역할에서 아예 SELECT 권한을 제거한다.
 * 이 경로만 검증된 사용자와 공고 작성자를 대조한 뒤 service-role로 읽는다.
 */
export async function GET(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const caller = await getVerifiedProfile(signal);
  if (!caller.ok) return authError(caller.reason);
  if (!caller.onboardedAt || caller.bannedAt) {
    return NextResponse.json({ error: '지원서를 조회할 권한이 없습니다.' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const jobId = params.get('jobId')?.trim() ?? '';
  const applicationId = params.get('applicationId')?.trim() ?? '';
  const rawCursor = params.get('cursor')?.trim() ?? '';
  const cursor = rawCursor ? parseCursor(rawCursor) : null;
  if (jobId && applicationId) {
    return NextResponse.json({ error: '조회 조건을 하나만 지정해주세요.' }, { status: 400 });
  }
  if ((jobId && !isUuid(jobId)) || (applicationId && !isUuid(applicationId))) {
    return NextResponse.json({ error: '지원서 정보를 확인해주세요.' }, { status: 400 });
  }
  if (rawCursor && !cursor) {
    return NextResponse.json({ error: '페이지 정보를 확인해주세요.' }, { status: 400 });
  }

  const service = createServiceClient(signal);

  if (applicationId) {
    const { data: application, error: applicationError } = await service
      .from('applications')
      .select(`*, applicant:profiles!inner(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('id', applicationId)
      .is('deleted_at', null)
      .is('applicant.deleted_at', null)
      .abortSignal(signal)
      .maybeSingle();
    if (applicationError) {
      return NextResponse.json({ error: '지원서를 불러오지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
    }
    if (!application) return NextResponse.json({ error: '지원서를 찾을 수 없습니다.' }, { status: 404 });

    const { data: job, error: jobError } = await service
      .from('jobs')
      .select('author_id')
      .eq('id', application.job_id)
      .abortSignal(signal)
      .maybeSingle();
    if (jobError) {
      return NextResponse.json({ error: '공고 정보를 확인하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
    }
    if (job?.author_id !== caller.profileId) {
      return NextResponse.json({ error: '지원서를 조회할 권한이 없습니다.' }, { status: 403 });
    }
    return NextResponse.json({ application });
  }

  if (jobId) {
    const { data: job, error: jobError } = await service
      .from('jobs')
      .select('id, author_id')
      .eq('id', jobId)
      .abortSignal(signal)
      .maybeSingle();
    if (jobError) {
      return NextResponse.json({ error: '공고 정보를 확인하지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
    }
    if (!job) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
    if (job.author_id !== caller.profileId) {
      return NextResponse.json({ error: '지원서를 조회할 권한이 없습니다.' }, { status: 403 });
    }

    let query = service
      .from('applications')
      .select(`*, applicant:profiles!inner(${PUBLIC_PROFILE_COLUMNS})`)
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .is('applicant.deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);
    if (cursor) {
      query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    const { data, error } = await query.abortSignal(signal);
    if (error) {
      return NextResponse.json({ error: '지원자 목록을 불러오지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
    }
    const applications = data ?? [];
    return NextResponse.json({ applications, nextCursor: nextCursor(applications) });
  }

  let query = service
    .from('applications')
    .select(`*, job:jobs!inner(*), applicant:profiles!inner(${PUBLIC_PROFILE_COLUMNS})`)
    .eq('job.author_id', caller.profileId)
    .is('deleted_at', null)
    .is('applicant.deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }
  const { data, error } = await query.abortSignal(signal);
  if (error) {
    return NextResponse.json({ error: '받은 지원서를 불러오지 못했습니다.' }, { status: signal.aborted ? 504 : 500 });
  }
  const applications = data ?? [];
  return NextResponse.json({ applications, nextCursor: nextCursor(applications) });
}
