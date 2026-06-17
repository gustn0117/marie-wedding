import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import MessageThread from '@/features/messages/components/MessageThread';
import ConversationSidebar from '@/features/messages/components/ConversationSidebar';
import type { Message } from '@/types/database';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function MessageDetailPage({ params }: Props) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!conv) notFound();
  if (conv.participant_a !== me.id && conv.participant_b !== me.id) {
    redirect(ROUTES.MYPAGE_MESSAGES);
  }

  const partnerId = conv.participant_a === me.id ? conv.participant_b : conv.participant_a;
  const { data: partner } = await supabase
    .from('profiles')
    .select('id, company_name, contact_name')
    .eq('id', partnerId)
    .maybeSingle();

  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  const partnerName = partner?.company_name || partner?.contact_name || '알 수 없음';

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
          <ConversationSidebar myProfileId={me.id} activeId={params.id} />
        </div>
        <section className="platform-panel overflow-hidden">
          <MessageThread
            conversationId={params.id}
            myProfileId={me.id}
            partnerName={partnerName}
            initialMessages={(msgs ?? []) as Message[]}
          />
        </section>
      </div>
    </main>
  );
}
