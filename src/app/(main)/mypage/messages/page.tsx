import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { formatRelativeTime } from '@/shared/utils/format';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string;
  partner_name: string;
  partner_image: string | null;
  last_body: string | null;
  unread: number;
}

async function loadConversations(myId: string): Promise<Row[]> {
  const supabase = createServerQueryClient();
  const { data: convs } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${myId},participant_b.eq.${myId}`)
    .order('last_message_at', { ascending: false });

  if (!convs || convs.length === 0) return [];

  const partnerIds = convs.map((c) => (c.participant_a === myId ? c.participant_b : c.participant_a));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, company_name, contact_name, profile_image, deleted_at')
    .in('id', partnerIds);
  const profileMap = new Map<string, { name: string; image: string | null }>();
  (profiles ?? []).forEach((p) => profileMap.set(p.id, {
    // 탈퇴 상대 실명 마스킹 — 대화 자체는 유지하되 이름/사진은 숨김
    name: p.deleted_at ? '탈퇴한 회원' : (p.company_name || p.contact_name || '알 수 없음'),
    image: p.deleted_at ? null : p.profile_image,
  }));

  // 기존: 대화 N개당 (last message + unread count) 2회 = 2N+1 쿼리
  // 변경: 모든 conversation의 메시지를 한 번에 가져와 in-memory 집계 = 3 쿼리 고정
  const convIds = convs.map((c) => c.id);

  const [{ data: lastMsgs }, { data: unreadRows }] = await Promise.all([
    supabase
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', convIds)
      .order('conversation_id', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', myId)
      .is('read_at', null),
  ]);

  const lastBodyMap = new Map<string, string>();
  for (const m of lastMsgs ?? []) {
    if (!lastBodyMap.has(m.conversation_id as string)) {
      lastBodyMap.set(m.conversation_id as string, (m.body as string) ?? '');
    }
  }

  const unreadCountMap = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    const cid = r.conversation_id as string;
    unreadCountMap.set(cid, (unreadCountMap.get(cid) ?? 0) + 1);
  }

  const rows: Row[] = convs.map((c) => {
    const partnerId = c.participant_a === myId ? c.participant_b : c.participant_a;
    const meta = profileMap.get(partnerId) ?? { name: '알 수 없음', image: null };
    return {
      id: c.id,
      participant_a: c.participant_a,
      participant_b: c.participant_b,
      last_message_at: c.last_message_at,
      partner_name: meta.name,
      partner_image: meta.image,
      last_body: lastBodyMap.get(c.id) ?? null,
      unread: unreadCountMap.get(c.id) ?? 0,
    };
  });

  return rows;
}

export default async function MessagesPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const conversations = await loadConversations(me.id);

  return (
    <main className="space-y-4">
      <PageHeader
        eyebrow="쪽지"
        title="쪽지"
        description="업체·프리랜서와 1:1로 대화할 수 있습니다. 채용 과정과 별개로도 사용할 수 있습니다."
      />

      <section className="surface">
        {conversations.length === 0 ? (
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
                      <p className="text-sm font-bold text-gray-900 truncate">{c.partner_name}</p>
                      {c.unread > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    {c.last_body && (
                      <p className="text-xs text-gray-500 truncate">{c.last_body}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatRelativeTime(c.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
