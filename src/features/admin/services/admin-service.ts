import type { Profile, Job, Post, Comment, Event, Report } from '@/types/database';

// Admin API 인증은 isAdminRequest()가 쿠키의 user → profile.role='admin'로 처리.
// 비밀번호 폴백은 옛 경로 — 미들웨어가 /admin 진입을 role로 가드하므로 더 이상 불필요.

async function adminFetch(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
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

  // ── Events ──
  getEvents: (page = 1, search?: string, type?: string, showDeleted = false) =>
    adminFetch('getEvents', { page, search, type, showDeleted }) as Promise<{ data: Event[]; count: number }>,
  getEvent: (id: string) => adminFetch('getEvent', { id }) as Promise<Event>,
  createEvent: (data: Partial<Event>) => adminFetch('createEvent', data as Record<string, unknown>) as Promise<Event>,
  updateEvent: (id: string, data: Partial<Event>) => adminFetch('updateEvent', { id, ...data }) as Promise<Event>,
  softDeleteEvent: (id: string) => adminFetch('softDeleteEvent', { id }),
  restoreEvent: (id: string) => adminFetch('restoreEvent', { id }),
};
