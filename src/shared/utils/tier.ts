import type { Job, Post } from '@/types/database';

export type Tier = 1 | 2 | 3;

function daysSince(date: string | null | undefined): number {
  if (!date) return Infinity;
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function daysUntil(date: string | null | undefined): number {
  if (!date) return Infinity;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getJobTier(job: Pick<Job, 'created_at' | 'deadline'>): Tier {
  const dUntil = daysUntil(job.deadline);
  if (dUntil >= 0 && dUntil <= 3) return 2;
  if (daysSince(job.created_at) <= 3) return 2;
  return 3;
}

export function getPostTier(post: Pick<Post, 'created_at'>): Tier {
  if (daysSince(post.created_at) <= 1) return 2;
  return 3;
}

export function isUrgent(deadline: string | null | undefined): boolean {
  const d = daysUntil(deadline);
  return d >= 0 && d <= 3;
}

export function isNew(createdAt: string | null | undefined): boolean {
  return daysSince(createdAt) <= 3;
}

export function getDDayLabel(deadline: string | null | undefined): string | null {
  if (!deadline) return null;
  const d = daysUntil(deadline);
  if (d < 0) return '마감';
  if (d === 0) return 'D-DAY';
  if (d <= 30) return `D-${d}`;
  return null;
}
