'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import type { ConversationSummary } from '@/features/messages/services/conversationSummaries';

/**
 * 대화 목록 사이드바 — 서버에서 집계한 요약(conversations)을 props 로 받아 즉시 렌더한다.
 * (이전: 클라이언트에서 useEffect 로 여러 번 네트워크 왕복 → 스켈레톤이 오래 떴다.)
 * 검색만 클라이언트에서 필터링한다.
 */
export default function ConversationSidebar({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? conversations.filter((c) => c.partnerName.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <aside className="surface overflow-hidden flex flex-col max-h-[700px]">
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
        {filtered.length === 0 ? (
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
