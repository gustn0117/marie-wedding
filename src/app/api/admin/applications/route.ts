import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import { isUuid } from '@/shared/utils/uuid';
import { parseSubmittedResumeSnapshot } from '@/features/resumes/lib/mapper';
import { isCanonicalResumeAttachmentPath, isCanonicalResumePhotoPath } from '@/features/resumes/lib/photo';
import {
  APPLICATION_VIEW_TRACKING_SINCE,
  STALE_UNSEEN_MS,
  applicationStage,
  isRespondedStatus,
  type AdminApplicationDetail,
  type AdminApplicationList,
  type AdminApplicationRow,
  type AdminApplicationSummary,
  type AdminContact,
  type ApplicationStage,
  type ApplicationViewRecord,
} from '@/features/admin/applicationStages';
import type { ApplicationStatus } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 관리자 지원 현황 — 누가 어느 공고에 지원했고, 공고자가 확인·열람·응답했는지.
 *  GET ?stage=&q=&jobId=&deleted=1&page=  목록 + 단계별 개수
 *  GET ?id=                              한 건 상세(지원 메시지·연락처·제출 이력서·확인 기록)
 *
 * 지원은 하루 수십 건 규모라 최근 FETCH_LIMIT 건을 한 번에 읽어 서버에서 단계를 계산·거른다.
 * 공고자 비공개 메모(author_note)는 운영에 필요 없어 읽지 않는다.
 */

const FETCH_LIMIT = 3000;
const PAGE_SIZE = 30;
const STAGES: ApplicationStage[] = ['unseen', 'untracked', 'seen', 'opened', 'responded', 'cancelled'];

type ProfileRow = {
  id: string;
  user_id?: string | null;
  company_name: string | null;
  contact_name: string | null;
  phone?: string | null;
  deleted_at: string | null;
};
type ViewRow = {
  first_seen_at: string;
  last_seen_at: string;
  detail_opened_at: string | null;
  detail_last_opened_at: string | null;
};
type JobRow = {
  id: string;
  title: string;
  deleted_at: string | null;
  proxy_company_name: string | null;
  proxy_contact?: string | null;
  author: ProfileRow | ProfileRow[] | null;
};
type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  deleted_at: string | null;
  first_responded_at: string | null;
  hiring_completed_at: string | null;
  applicant_completed_at: string | null;
  message?: string;
  contact_phone?: string | null;
  job: JobRow | JobRow[] | null;
  applicant: ProfileRow | ProfileRow[] | null;
  view: ViewRow | ViewRow[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function personName(profile: ProfileRow, prefer: 'person' | 'company'): string {
  const company = profile.company_name?.trim();
  const person = profile.contact_name?.trim();
  return (prefer === 'company' ? company || person : person || company) || '(이름 없음)';
}

function toView(row: ViewRow | null): ApplicationViewRecord | null {
  if (!row) return null;
  return {
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    detailOpenedAt: row.detail_opened_at,
    detailLastOpenedAt: row.detail_last_opened_at,
  };
}

function toRow(raw: ApplicationRow): AdminApplicationRow {
  const job = one(raw.job);
  const author = job ? one(job.author) : null;
  const applicant = one(raw.applicant);
  const view = toView(one(raw.view));
  return {
    id: raw.id,
    createdAt: raw.created_at,
    deletedAt: raw.deleted_at,
    status: raw.status,
    stage: applicationStage({ status: raw.status, createdAt: raw.created_at, view }),
    firstRespondedAt: isRespondedStatus(raw.status) ? raw.first_responded_at : null,
    hiringCompletedAt: raw.hiring_completed_at,
    applicantCompletedAt: raw.applicant_completed_at,
    view,
    applicant: applicant ? { id: applicant.id, name: personName(applicant, 'person'), deleted: !!applicant.deleted_at } : null,
    job: job ? { id: job.id, title: job.title, deleted: !!job.deleted_at, isProxy: !!job.proxy_company_name } : null,
    author: author ? { id: author.id, name: personName(author, 'company'), deleted: !!author.deleted_at } : null,
  };
}

const LIST_SELECT = `id, status, created_at, deleted_at, first_responded_at, hiring_completed_at, applicant_completed_at,
  job:jobs(id, title, deleted_at, proxy_company_name, author:profiles!jobs_author_id_fkey(id, company_name, contact_name, deleted_at)),
  applicant:profiles(id, company_name, contact_name, deleted_at),
  view:application_views(first_seen_at, last_seen_at, detail_opened_at, detail_last_opened_at)`;

const DETAIL_SELECT = `id, status, message, contact_phone, created_at, deleted_at, first_responded_at, hiring_completed_at, applicant_completed_at,
  job:jobs(id, title, deleted_at, proxy_company_name, proxy_contact, author:profiles!jobs_author_id_fkey(id, user_id, company_name, contact_name, phone, deleted_at)),
  applicant:profiles(id, user_id, company_name, contact_name, phone, deleted_at),
  view:application_views(first_seen_at, last_seen_at, detail_opened_at, detail_last_opened_at)`;

async function getList(url: URL) {
  const stageParam = url.searchParams.get('stage') ?? 'all';
  const stage = (STAGES as string[]).includes(stageParam) ? (stageParam as ApplicationStage) : null;
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 100);
  const jobIdParam = url.searchParams.get('jobId') ?? '';
  const jobId = isUuid(jobIdParam) ? jobIdParam : '';
  const includeDeleted = url.searchParams.get('deleted') === '1';
  const page = Math.max(1, Math.min(1000, parseInt(url.searchParams.get('page') || '1', 10) || 1));

  const supabase = createServiceClient(AbortSignal.timeout(15_000));
  let request = supabase
    .from('applications')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FETCH_LIMIT);
  if (!includeDeleted) request = request.is('deleted_at', null);
  if (jobId) request = request.eq('job_id', jobId);

  const { data, error } = await request;
  if (error) {
    console.error('[api/admin/applications] list failed:', error.message);
    return NextResponse.json({ error: '지원 현황을 불러오지 못했습니다.' }, { status: 500 });
  }
  const raws = (data ?? []) as unknown as ApplicationRow[];
  const searchable = raws.map((raw) => {
    const row = toRow(raw);
    const job = one(raw.job);
    const haystack = [
      row.applicant?.name,
      row.job?.title,
      row.author?.name,
      job?.proxy_company_name,
      one(raw.applicant)?.company_name,
      one(raw.applicant)?.contact_name,
    ].filter(Boolean).join(' ').toLowerCase();
    return { row, haystack };
  });
  const matched = query ? searchable.filter((item) => item.haystack.includes(query)).map((item) => item.row) : searchable.map((item) => item.row);

  // 단계별 개수는 검색·공고 조건을 반영한 집합 기준(탭 숫자와 목록이 맞도록)
  const now = Date.now();
  const summary: AdminApplicationSummary = {
    total: matched.length, unseen: 0, unseenStale: 0, seen: 0, opened: 0, responded: 0, cancelled: 0, untracked: 0,
  };
  for (const row of matched) {
    summary[row.stage] += 1;
    if (row.stage === 'unseen' && now - Date.parse(row.createdAt) > STALE_UNSEEN_MS) summary.unseenStale += 1;
  }

  const filtered = stage ? matched.filter((row) => row.stage === stage) : matched;
  const start = (page - 1) * PAGE_SIZE;
  const firstJob = jobId ? searchable.find((item) => item.row.job?.id === jobId)?.row.job : null;

  const body: AdminApplicationList = {
    trackingSince: APPLICATION_VIEW_TRACKING_SINCE,
    truncated: raws.length >= FETCH_LIMIT,
    summary,
    page,
    pageSize: PAGE_SIZE,
    totalFiltered: filtered.length,
    job: firstJob ? { id: firstJob.id, title: firstJob.title } : null,
    items: filtered.slice(start, start + PAGE_SIZE),
  };
  return NextResponse.json(body);
}

async function contactOf(
  supabase: ReturnType<typeof createServiceClient>,
  profile: ProfileRow | null,
  prefer: 'person' | 'company',
): Promise<AdminContact | null> {
  if (!profile) return null;
  let email: string | null = null;
  if (profile.user_id) {
    try {
      const { data } = await supabase.auth.admin.getUserById(profile.user_id);
      email = data.user?.email ?? null;
    } catch (error) {
      console.error('[api/admin/applications] getUserById failed:', error);
    }
  }
  return {
    id: profile.id,
    name: personName(profile, prefer),
    deleted: !!profile.deleted_at,
    phone: profile.phone ?? null,
    email,
  };
}

async function getDetail(id: string) {
  const supabase = createServiceClient(AbortSignal.timeout(15_000));
  const [{ data, error }, { data: snapshotRow, error: snapshotError }] = await Promise.all([
    supabase.from('applications').select(DETAIL_SELECT).eq('id', id).maybeSingle(),
    supabase.from('application_resume_snapshots').select('snapshot, created_at').eq('application_id', id).maybeSingle(),
  ]);
  if (error) {
    console.error('[api/admin/applications] detail failed:', error.message);
    return NextResponse.json({ error: '지원 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '지원을 찾을 수 없습니다.' }, { status: 404 });
  if (snapshotError) console.error('[api/admin/applications] snapshot failed:', snapshotError.message);

  const raw = data as unknown as ApplicationRow;
  const job = one(raw.job);
  const view = toView(one(raw.view));
  const [applicant, author] = await Promise.all([
    contactOf(supabase, one(raw.applicant), 'person'),
    contactOf(supabase, job ? one(job.author) : null, 'company'),
  ]);

  // 제출 이력서의 사진·첨부는 공고자·지원자 전용 주소라 관리자 화면에선 열리지 않는다 → 관리자 전용 주소로 바꿔 준다.
  const resume = parseSubmittedResumeSnapshot(snapshotRow?.snapshot);
  const fileUrls: Record<string, string> = {};
  if (resume && resume.redacted !== true) {
    const paths = [
      resume.photoPath && isCanonicalResumePhotoPath(resume.photoPath) ? resume.photoPath : null,
      ...(resume.attachments ?? []).map((item) => (isCanonicalResumeAttachmentPath(item.path) ? item.path : null)),
    ].filter((path): path is string => !!path);
    for (const path of paths) fileUrls[path] = `/api/admin/applications/file?path=${encodeURIComponent(path)}`;
  }

  const body: AdminApplicationDetail = {
    application: {
      id: raw.id,
      status: raw.status,
      stage: applicationStage({ status: raw.status, createdAt: raw.created_at, view }),
      message: raw.message ?? '',
      contactPhone: raw.contact_phone ?? null,
      createdAt: raw.created_at,
      deletedAt: raw.deleted_at,
      firstRespondedAt: isRespondedStatus(raw.status) ? raw.first_responded_at : null,
      hiringCompletedAt: raw.hiring_completed_at,
      applicantCompletedAt: raw.applicant_completed_at,
    },
    view,
    applicant,
    author,
    job: job
      ? {
          id: job.id,
          title: job.title,
          deleted: !!job.deleted_at,
          isProxy: !!job.proxy_company_name,
          proxyCompanyName: job.proxy_company_name,
          proxyContact: job.proxy_contact ?? null,
        }
      : null,
    resume,
    resumeSubmittedAt: snapshotRow?.created_at ?? null,
    fileUrls,
  };
  return NextResponse.json(body);
}

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id !== null) {
    if (!isUuid(id)) return NextResponse.json({ error: '지원 정보를 확인해주세요.' }, { status: 400 });
    return getDetail(id);
  }
  return getList(url);
}
