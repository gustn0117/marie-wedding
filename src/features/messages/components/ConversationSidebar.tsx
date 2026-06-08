'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';

interface Conversation {
  id: string;
  partnerName: string;
  partnerImage: string | null;
  lastBody: string | null;
  lastMessageAt: string;
  unread: number;
}

export default function ConversationSidebar({ myProfileId, activeId }: { myProfileId: string; activeId: string }) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data: convs } = await sb
      .from('conversations')
      .select('id, participant_a, participant_b, last_message_at')
      .or(`participant_a.eq.${myProfileId},participant_b.eq.${myProfileId}`)
      .order('last_message_at', { ascending: false })
      .limit(50);

    const list = (convs ?? []) as Array<{ id: string; participant_a: string; participant_b: string; last_message_at: string }>;
    if (list.length === 0) { setItems([]); setLoading(false); return; }

    const partnerIds = Array.from(new Set(list.map((c) => c.participant_a === myProfileId ? c.participant_b : c.participant_a)));
    const convIds = list.map((c) => c.id);

    const [partnersRes, lastMsgsRes, unreadRes] = await Promise.all([
      sb.from('profiles').select('id, company_name, contact_name, profile_image').in('id', partnerIds),
      sb.from('messages').select('conversation_id, body, created_at').in('conversation_id', convIds).order('created_at', { ascending: false }),
      sb.from('messages').select('conversation_id').in('conversation_id', convIds).is('read_at', null).neq('sender_id', myProfileId),
    ]);

    const partnerMap = new Map<string, { name: string; image: string | null }>();
    for (const p of (partnersRes.data ?? []) as Array<{ id: string; company_name: string | null; contact_name: string; profile_image: string | null }>) {
      partnerMap.set(p.id, { name: p.company_name || p.contact_name, image: p.profile_image });
    }
    const lastMsgMap = new Map<string, string>();
    for (const m of (lastMsgsRes.data ?? []) as Array<{ conversation_id: string; body: string }>) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m.body);
    }
    const unreadMap = new Map<string, number>();
    for (const m of (unreadRes.data ?? []) as Array<{ conversation_id: string }>) {
      unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
    }

    const rows: Conversation[] = list.map((c) => {
      const partnerId = c.participant_a === myProfileId ? c.participant_b : c.participant_a;
      const partner = partnerMap.get(partnerId);
      return {
        id: c.id,
        partnerName: partner?.name ?? '알 수 없음',
        partnerImage: partner?.image ?? null,
        lastBody: lastMsgMap.get(c.id) ?? null,
        lastMessageAt: c.last_message_at,
        unread: unreadMap.get(c.id) ?? 0,
      };
    });
    setItems(rows);
    setLoading(false);
  }, [myProfileId]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? items.filter((c) => c.partnerName.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <aside className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col max-h-[700px]">
      <header className="p-3 border-b border-gray-100">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">대화</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="상대 이름 검색"
          className="w-full h-8 px-2.5 rounded border border-gray-300 bg-white text-xs hover:border-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
      </header>
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-xs text-gray-400">{search ? '검색 결과 없음' : '대화가 없습니다'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={ROUTES.MYPAGE_MESSAGE_DETAIL(c.id)}
                    className={`flex gap-2.5 p-3 hover:bg-gray-50 transition-colors ${isActive ? 'bg-primary-50/50 border-l-2 border-l-primary' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 shrink-0 overflow-hidden">
                      {c.partnerImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.partnerImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.partnerName.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className={`text-sm truncate flex-1 ${c.unread > 0 ? 'font-bold text-ink' : 'font-semibold text-gray-700'}`}>{c.partnerName}</p>
                        {c.unread > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full tabular-nums">
                            {c.unread > 9 ? '9+' : c.unread}
                          </span>
                        )}
                      </div>
                      {c.lastBody && (
                        <p className="text-xs text-gray-500 truncate">{c.lastBody}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(c.lastMessageAt)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
