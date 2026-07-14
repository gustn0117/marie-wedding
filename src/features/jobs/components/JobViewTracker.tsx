'use client';

import { useEffect } from 'react';

export const RECENT_JOBS_KEY = 'marie_recent_jobs';
const RECENT_MAX = 20;

function pushRecent(jobId: string) {
  try {
    const raw = localStorage.getItem(RECENT_JOBS_KEY) || '[]';
    const arr = (JSON.parse(raw) as string[]).filter((id) => id && id !== jobId);
    const next = [jobId, ...arr].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

/**
 * '최근 본 공고' 기록용(localStorage). 조회수 시스템은 제거됨 — DB 증가 없음.
 */
export default function JobViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    pushRecent(jobId);
  }, [jobId]);

  return null;
}
