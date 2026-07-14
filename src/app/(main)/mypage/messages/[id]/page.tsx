import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { getCurrentVerifiedProfile } from '@/lib/supabase/verified-profile';
import { ROUTES } from '@/shared/constants';
import MessageThread from '@/features/messages/components/MessageThread';
import ConversationSidebar from '@/features/messages/components/ConversationSidebar';
import { loadConversationSummaries } from '@/features/messages/services/conversationSummaries';
import type { Message } from '@/types/database';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MessageDetailPage({ params }: Props) {
  const { id } = await params;
  const viewer = await getCurrentVerifiedProfile();
  if (!viewer.ok) redirect(ROUTES.LOGIN);
  const profileId = viewer.profileId;

  const supabase = createServerQueryClient();
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!conv) notFound();
  if (conv.participant_a !== profileId && conv.participant_b !== profileId) {
    redirect(ROUTES.MYPAGE_MESSAGES);
  }

  const partnerId = conv.participant_a === profileId ? conv.participant_b : conv.participant_a;
  // 이 대화를 열었으니 관련 '새 메시지' 알림을 읽음 처리 → 헤더 안읽음 배지 정리.
  // (service_role 이라 RLS 우회, 본인 것만 profile_id 로 한정)
  await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('profile_id', profileId).eq('link_url', `/mypage/messages/${id}`).is('read_at', null);

  // 상대방이 보낸 안읽음 메시지를 서버에서 읽음 처리 → 쪽지 안읽음 배지가 확실히 사라짐.
  // (클라 mark_messages_read RPC 는 세션 토큰 지연으로 실패하던 문제 회피)
  await supabase.from('messages').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id).neq('sender_id', profileId).is('read_at', null);

  // 파트너 · 메시지 · 사이드바 대화목록을 병렬 조회(서버·내부 kong 직결이라 빠름).
  const [partnerRes, msgsRes, conversations] = await Promise.all([
    supabase.from('profiles').select('id, company_name, contact_name, deleted_at').eq('id', partnerId).maybeSingle(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    loadConversationSummaries(profileId),
  ]);
  const partner = partnerRes.data;
  const msgs = msgsRes.data;

  const partnerName = partner?.deleted_at
    ? '탈퇴한 회원'
    : (partner?.company_name || partner?.contact_name || '알 수 없음');

  return (
    <main className="mx-auto max-w-6xl space-y-4">
      <nav className="text-sm text-gray-500">
        <Link href={ROUTES.MYPAGE} className="hover:text-primary">마이페이지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <Link href={ROUTES.MYPAGE_MESSAGES} className="hover:text-primary">쪽지</Link>
        <span className="mx-2 text-gray-300">›</span>
        <span className="text-gray-900 font-medium truncate">{partnerName}</span>
      </nav>

      {/* 2-pane: 좌측 대화 목록 (lg 이상) + 우측 현재 대화 */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="hidden lg:block">
          <ConversationSidebar conversations={conversations} activeId={id} />
        </div>
        <section className="platform-panel overflow-hidden">
          <MessageThread
            conversationId={id}
            myProfileId={profileId}
            partnerName={partnerName}
            initialMessages={(msgs ?? []) as Message[]}
          />
        </section>
      </div>
    </main>
  );
}
