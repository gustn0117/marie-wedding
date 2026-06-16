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
    .select('id, company_name, contact_name, profile_image')
    .in('id', partnerIds);
  const profileMap = new Map<string, { name: string; image: string | null }>();
  (profiles ?? []).forEach((p) => profileMap.set(p.id, {
    name: p.company_name || p.contact_name || '알 수 없음',
    image: p.profile_image,
  }));

  const rows: Row[] = [];
  for (const c of convs) {
    const partnerId = c.participant_a === myId ? c.participant_b : c.participant_a;
    const meta = profileMap.get(partnerId) ?? { name: '알 수 없음', image: null };
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('body')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)
      .neq('sender_id', myId)
      .is('read_at', null);
    rows.push({
      id: c.id,
      participant_a: c.participant_a,
      participant_b: c.participant_b,
      last_message_at: c.last_message_at,
      partner_name: meta.name,
      partner_image: meta.image,
      last_body: lastMsg?.body ?? null,
      unread: count ?? 0,
    });
  }
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
        eyebrow="메시지"
        title="메시지"
        description="업체·프리랜서와 1:1로 대화할 수 있습니다. 채용 과정과 별개로도 사용할 수 있습니다."
      />

      <section className="surface">
        {conversations.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">아직 대화가 없습니다. 디렉토리 상세에서 &quot;메시지 보내기&quot;로 시작해 보세요.</p>
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
