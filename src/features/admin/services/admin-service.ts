import type { Profile, Job, Post, Comment, Event, Report } from '@/types/database';

const STORAGE_KEY = 'marie_admin_password';

function getPassword(): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

async function adminFetch(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: getPassword(), action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const adminService = {
  ping: (password?: string) => adminFetch('ping', password ? { password } : {}) as Promise<{ success: true }>,
  savePassword: (password: string) => sessionStorage.setItem(STORAGE_KEY, password),
  clearPassword: () => sessionStorage.removeItem(STORAGE_KEY),
  hasSavedPassword: () => sessionStorage.getItem(STORAGE_KEY) !== null,

  // ── Dashboard ──
  getStats: () => adminFetch('getStats') as Promise<{
    users: number; jobs: number; posts: number; comments: number; reports: number;
    recentUsers: number; recentJobs: number;
  }>,

  getRecentUsers: (limit = 5) => adminFetch('getRecentUsers', { limit }) as Promise<Profile[]>,
  getRecentJobs: (limit = 5) => adminFetch('getRecentJobs', { limit }) as Promise<Job[]>,

  // ── Users ──
  getUsers: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getUsers', { page, search, showDeleted }) as Promise<{ data: Profile[]; count: number }>,
  updateUserRole: (id: string, role: 'user' | 'admin') => adminFetch('updateUserRole', { id, role }),
  softDeleteUser: (id: string) => adminFetch('softDeleteUser', { id }),
  restoreUser: (id: string) => adminFetch('restoreUser', { id }),

  // ── Jobs ──
  getJobs: (page = 1, search?: string, showDeleted = false) =>
    adminFetch('getJobs', { page, search, showDeleted }) as Promise<{ data: Job[]; count: number }>,
  softDeleteJob: (id: string) => adminFetch('softDeleteJob', { id }),
  restoreJob: (id: string) => adminFetch('restoreJob', { id }),

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
