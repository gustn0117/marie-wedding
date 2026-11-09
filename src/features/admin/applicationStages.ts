import type { ApplicationStatus } from '@/types/database';

/**
 * 관리자 '지원 현황' — 공고자 확인 단계 계산과 화면·API 가 함께 쓰는 형식.
 *
 * 공고자 확인 기록(application_views)은 이 시각부터 남는다. 그 전에 접수됐고 아직 기록이 없는 지원은
 * '미확인'이 아니라 '기록 없음'으로 보여 준다(그 전에 공고자가 봤는지는 알 수 없으므로).
 */
export const APPLICATION_VIEW_TRACKING_SINCE = '2026-11-09T17:45:00+09:00';

/** 미확인 상태로 이만큼 지나면 눈에 띄게 표시한다. */
export const STALE_UNSEEN_MS = 3 * 24 * 60 * 60 * 1000;

export type ApplicationStage = 'unseen' | 'untracked' | 'seen' | 'opened' | 'responded' | 'cancelled';

export const APPLICATION_STAGES: ApplicationStage[] = ['unseen', 'seen', 'opened', 'responded', 'cancelled', 'untracked'];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  unseen: '미확인',
  seen: '목록에서 확인',
  opened: '지원서 열람',
  responded: '응답 완료',
  cancelled: '지원 취소',
  untracked: '기록 없음',
};

export const APPLICATION_STAGE_HELP: Record<ApplicationStage, string> = {
  unseen: '공고자가 아직 이 지원을 보지 않았습니다.',
  seen: '공고자 화면(공고 페이지 지원자 목록·마이페이지 받은 지원)에 이 지원이 보였습니다.',
  opened: '공고자가 지원서 상세(제출 이력서)를 열어 봤습니다.',
  responded: '공고자가 상태를 바꿨습니다(검토 중·승인·거절).',
  cancelled: '지원자가 지원을 취소했습니다.',
  untracked: '확인 기록을 남기기 전에 접수된 지원이라 그동안 공고자가 봤는지 알 수 없습니다.',
};

/** 공고자가 '응답'한 상태 — 지원자 취소(cancelled)는 공고자 응답이 아니다. */
const RESPONDED_STATUSES = new Set<ApplicationStatus>(['reviewing', 'accepted', 'rejected']);

export interface ApplicationViewRecord {
  firstSeenAt: string;
  lastSeenAt: string;
  detailOpenedAt: string | null;
  detailLastOpenedAt: string | null;
}

export function applicationStage(input: {
  status: ApplicationStatus;
  createdAt: string;
  view: ApplicationViewRecord | null;
}): ApplicationStage {
  if (input.status === 'cancelled') return 'cancelled';
  if (RESPONDED_STATUSES.has(input.status)) return 'responded';
  if (input.view?.detailOpenedAt) return 'opened';
  if (input.view) return 'seen';
  return Date.parse(input.createdAt) < Date.parse(APPLICATION_VIEW_TRACKING_SINCE) ? 'untracked' : 'unseen';
}

export function isRespondedStatus(status: ApplicationStatus): boolean {
  return RESPONDED_STATUSES.has(status);
}

export interface AdminPerson {
  id: string;
  name: string;
  deleted: boolean;
}

export interface AdminApplicationRow {
  id: string;
  createdAt: string;
  deletedAt: string | null;
  status: ApplicationStatus;
  stage: ApplicationStage;
  /** 공고자의 첫 응답 시각 — 응답 상태(검토 중·승인·거절)일 때만 */
  firstRespondedAt: string | null;
  hiringCompletedAt: string | null;
  applicantCompletedAt: string | null;
  view: ApplicationViewRecord | null;
  applicant: AdminPerson | null;
  job: { id: string; title: string; deleted: boolean; isProxy: boolean } | null;
  /** 공고자(공고 작성자) */
  author: AdminPerson | null;
}

export interface AdminApplicationSummary {
  total: number;
  unseen: number;
  /** 미확인 중 3일 넘게 지난 것 */
  unseenStale: number;
  seen: number;
  opened: number;
  responded: number;
  cancelled: number;
  untracked: number;
}

export interface AdminApplicationList {
  trackingSince: string;
  /** 최근 순으로 읽은 한도에 걸려 오래된 지원이 빠졌는지 */
  truncated: boolean;
  summary: AdminApplicationSummary;
  page: number;
  pageSize: number;
  totalFiltered: number;
  job: { id: string; title: string } | null;
  items: AdminApplicationRow[];
}

export interface AdminContact extends AdminPerson {
  phone: string | null;
  email: string | null;
}

export interface AdminApplicationDetail {
  application: {
    id: string;
    status: ApplicationStatus;
    stage: ApplicationStage;
    message: string;
    contactPhone: string | null;
    createdAt: string;
    deletedAt: string | null;
    firstRespondedAt: string | null;
    hiringCompletedAt: string | null;
    applicantCompletedAt: string | null;
  };
  view: ApplicationViewRecord | null;
  applicant: AdminContact | null;
  author: AdminContact | null;
  job: {
    id: string;
    title: string;
    deleted: boolean;
    isProxy: boolean;
    proxyCompanyName: string | null;
    proxyContact: string | null;
  } | null;
  /** 제출 이력서(지원 시점 고정본). 형식은 이력서 미리보기 컴포넌트가 해석한다. */
  resume: unknown;
  resumeSubmittedAt: string | null;
  /** 이력서 사진·첨부 경로 → 관리자 전용 열람 주소 */
  fileUrls: Record<string, string>;
}
