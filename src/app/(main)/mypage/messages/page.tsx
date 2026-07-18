import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import PageHeader from '@/shared/components/PageHeader';
import LoadErrorState from '@/shared/components/LoadErrorState';
import { loadConversationSummaries } from '@/features/messages/services/conversationSummaries';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);

  // 조회 실패를 "대화 없음"으로 오인시키지 않는다.
  let conversations: Awaited<ReturnType<typeof loadConversationSummaries>> = [];
  let loadFailed = false;
  try {
    conversations = await loadConversationSummaries(viewer.profileId);
  } catch {
    loadFailed = true;
  }

  return (
    <main className="space-y-4">
      <PageHeader
        eyebrow="쪽지"
        title="쪽지"
        description="업체·프리랜서와 1:1로 대화할 수 있습니다. 채용 과정과 별개로도 사용할 수 있습니다."
      />

      <section className="surface">
        {loadFailed ? (
          <LoadErrorState message="대화 목록을 불러오지 못했습니다." />
        ) : conversations.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">아직 대화가 없습니다. 디렉토리 상세에서 &quot;쪽지 보내기&quot;로 시작해 보세요.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={ROUTES.MYPAGE_MESSAGE_DETAIL(c.id)}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-primary-50/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{c.partnerName}</p>
                      {c.unread > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    {c.lastBody && (
                      <p className="text-xs text-gray-500 truncate">{c.lastBody}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(c.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
