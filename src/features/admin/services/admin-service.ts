import { apiFetch, apiFetchJson } from '@/shared/utils/apiFetch';
import type { Profile, Job, Post, Comment, Event, Report, ModerationKeyword } from '@/types/database';

export interface AuditLogRow {
  id: number;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_columns: string[] | null;
  changed_at: string;
  changer?: {
    id: string;
    company_name: string | null;
    contact_name: string;
    profile_image: string | null;
  } | null;
}

export interface ReportStatusStats {
  open: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  today: number;
}

// Admin API 인증은 서명된 잠금 해제 쿠키 또는 profile.role='admin' 세션으로만 처리한다.
// 평문 비밀번호는 /api/admin/unlock 외의 요청에 포함하지 않는다.

async function adminFetch(action: string, params: Record<string, unknown> = {}) {
  const res = await apiFetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function adminOperationsFetch<T>(action: string, params: Record<string, unknown> = {}) {
  return apiFetchJson<T>('/api/admin/operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  }, {
    // 서버의 10초 deadline 직후 오류 응답을 받을 수 있도록 짧은 여유만 둔다.
    timeoutMs: 12_000,
    fallbackError: '관리자 작업을 처리하지 못했습니다.',
  });
}

export const adminService = {
  // ── Dashboard ──
  getStats: () => adminFetch('getStats') as Promise<{
    users: number; jobs: number; posts: number; comments: number; reports: number;
    recentUsers: number; recentJobs: number;
  }>,

  getRecentUsers: (limit = 5) => adminFetch('getRecentUsers', { limit }) as Promise<Profile[]>,
  getRecentJobs: (limit = 5) => adminFetch('getRecentJobs', { limit }) as Promise<Job[]>,

  // 대시보드 한 방 호출 — stats + funnel + recent users + recent jobs를 단일 응답으로
  getDashboard: () =>
    adminFetch('getDashboard', {}) as Promise<{
      stats: {
        users: number; jobs: number; posts: number; comments: number;
        reports: number; recentUsers: number; recentJobs: number;
      };
      funnel: {
        totalApplications: number; acceptedApplications: number;
        completedApplications: number; reviewsWritten: number;
      };
      recentUsers: Profile[];
      recentJobs: Job[];
    }>,

  // ── Users ──
  getUsers: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getUsers', { page, search, showDeleted }) as Promise<{ data: Profile[]; count: number }>,
  getUserDetail: (id: string) =>
    adminFetch('getUserDetail', { id }) as Promise<{
      profile: Profile;
      auth: {
        id: string;
        email: string | null;
        phone: string | null;
        created_at: string | null;
        last_sign_in_at: string | null;
        email_confirmed_at: string | null;
        identities: Array<{ provider: string; last_sign_in_at: string | null; identity_data: Record<string, unknown> | null }>;
        banned_until: string | null;
      } | null;
      activity: {
        jobs: number;
        posts: number;
        comments: number;
        applications_sent: number;
        applications_received: number;
      };
    }>,
  updateUserRole: (id: string, role: 'user' | 'admin') => adminFetch('updateUserRole', { id, role }),
  softDeleteUser: (id: string) => adminFetch('softDeleteUser', { id }),
  restoreUser: (id: string) => adminFetch('restoreUser', { id }),
  purgeUser: (profileId: string) =>
    adminOperationsFetch<{ ok: true }>('purgeUser', { profileId }),
  restoreUserCascade: (profileId: string, restoreContent: boolean) =>
    adminOperationsFetch<{ ok: true }>('restoreUser', { profileId, restoreContent }),
  banUser: (profileId: string, reason: string) =>
    adminOperationsFetch<{ ok: true }>('banUser', { profileId, reason }),
  setAdminNote: (profileId: string, note: string | null) =>
    adminOperationsFetch<{ ok: true }>('setAdminNote', { profileId, note }),
  unbanUser: (profileId: string) =>
    adminOperationsFetch<{ ok: true }>('unbanUser', { profileId }),

  // ── Moderation ──
  getModerationKeywords: async () => {
    const result = await adminOperationsFetch<{ data: ModerationKeyword[] }>('listModerationKeywords');
    return result.data;
  },
  addModerationKeyword: async (
    keyword: string,
    scope: ModerationKeyword['scope'],
    moderationAction: ModerationKeyword['action'],
  ) => {
    const result = await adminOperationsFetch<{ data: ModerationKeyword }>('addModerationKeyword', {
      keyword,
      scope,
      moderationAction,
    });
    return result.data;
  },
  deleteModerationKeyword: (id: string) =>
    adminOperationsFetch<{ ok: true }>('deleteModerationKeyword', { id }),

  // ── Audit ──
  getAuditLog: async (params: {
    page: number;
    table?: string;
    changeAction?: string;
    recordId?: string;
  }) => {
    const result = await adminOperationsFetch<{ data: AuditLogRow[] }>('getAuditLog', params);
    return result.data;
  },

  // ── Jobs ──
  getJobs: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getJobs', { page, search, showDeleted }) as Promise<{ data: Job[]; count: number }>,
  softDeleteJob: (id: string) => adminFetch('softDeleteJob', { id }),
  restoreJob: (id: string) => adminFetch('restoreJob', { id }),
  // 인기 공고
  getFeaturedJobs: () => adminFetch('getFeaturedJobs', {}) as Promise<Job[]>,
  toggleFeaturedJob: (id: string, featured: boolean) =>
    adminFetch('toggleFeaturedJob', { id, featured }),
  reorderFeaturedJobs: (orderedIds: string[]) =>
    adminFetch('reorderFeaturedJobs', { orderedIds }),
  // 추천 프로필 (메인 노출)
  toggleFeaturedProfile: (id: string, featured: boolean) =>
    adminFetch('toggleFeaturedProfile', { id, featured }),

  // ── Posts ──
  getPosts: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getPosts', { page, search, showDeleted }) as Promise<{ data: Post[]; count: number }>,
  softDeletePost: (id: string) => adminFetch('softDeletePost', { id }),
  restorePost: (id: string) => adminFetch('restorePost', { id }),

  // ── Comments ──
  getComments: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getComments', { page, search, showDeleted }) as Promise<{ data: (Comment & { post?: Post })[]; count: number }>,
  softDeleteComment: (id: string) => adminFetch('softDeleteComment', { id }),
  restoreComment: (id: string) => adminFetch('restoreComment', { id }),

  // ── Reports ──
  getReports: (page = 1, status?: string) =>
    adminFetch('getReports', { page, status }) as Promise<{ data: (Report & { reporter?: Profile })[]; count: number }>,
  updateReportStatus: (id: string, status: Report['status']) =>
    adminFetch('updateReportStatus', { id, status }) as Promise<Report & { reporter?: Profile }>,
  getReportStats: async () => {
    const result = await adminOperationsFetch<{ data: ReportStatusStats }>('getReportStats');
    return result.data;
  },

  // ── Events ──
  getEvents: (page = 1, search?: string, type?: string, showDeleted = false) =>
    adminFetch('getEvents', { page, search, type, showDeleted }) as Promise<{ data: Event[]; count: number }>,
  getEvent: (id: string) => adminFetch('getEvent', { id }) as Promise<Event>,
  createEvent: (data: Partial<Event>, createId: string) =>
    adminFetch('createEvent', { ...(data as Record<string, unknown>), id: createId }) as Promise<Pick<Event, 'id'>>,
  updateEvent: (id: string, data: Partial<Event>) => adminFetch('updateEvent', { id, ...data }) as Promise<Event>,
  softDeleteEvent: (id: string) => adminFetch('softDeleteEvent', { id }),
  restoreEvent: (id: string) => adminFetch('restoreEvent', { id }),
};
