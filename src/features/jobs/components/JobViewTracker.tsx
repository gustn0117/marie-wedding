'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const SESSION_KEY_PREFIX = 'mv:';
const STORAGE_KEY = 'marie_viewer_token';

function getViewerKey(): string {
  try {
    let token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export default function JobViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    let cancelled = false;
    const sessionKey = SESSION_KEY_PREFIX + jobId;
    try {
      if (sessionStorage.getItem(sessionKey)) return; // 같은 탭에서 한 번만
    } catch { /* sessionStorage 사용 불가 환경 */ }

    const viewerKey = getViewerKey();
    const supabase = createClient();

    supabase.rpc('increment_job_view_count', {
      p_job_id: jobId,
      p_viewer_key: viewerKey,
    }).then(() => {
      if (cancelled) return;
      try { sessionStorage.setItem(sessionKey, '1'); } catch { /* noop */ }
    }, () => { /* swallow errors — view count is not critical */ });

    return () => { cancelled = true; };
  }, [jobId]);

  return null;
}
