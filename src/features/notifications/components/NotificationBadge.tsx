'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  profileId: string;
}

export default function NotificationBadge({ profileId }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const sb = createClient();
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .is('read_at', null)
        .is('deleted_at', null);
      if (!cancelled) setCount(count ?? 0);
    };
    load();
    // 60초마다 새로고침
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [profileId]);

  if (!count || count <= 0) return null;

  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-state-urgent text-white text-[10px] font-bold rounded-full tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
}
