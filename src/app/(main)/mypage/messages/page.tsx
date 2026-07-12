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

  // 대화 미리보기(마지막 메시지 1건 + 안읽음 수)를 서버 RPC로 집계한다.
  // 기존엔 모든 대화의 전체 메시지 body를 한 번에 가져와 in-memory에서 첫 행만
  // 취했기 때문에 대화·메시지가 쌓일수록 전송량이 무한 증가했다. RPC는
  // DISTINCT ON (conversation_id) 으로 대화당 1건만 뽑고 body는 LEFT(body, 100)
  // 로 잘라 반환하므로, 전송량이 (2,000자 본문 × 전체 메시지)가 아니라 대화 수에
  // 비례해 유계가 된다. (get_conversation_previews RPC 정의는 별도 SQL 마이그레이션 필요)
  const { data: previews } = await supabase.rpc('get_conversation_previews', {
    p_profile_id: myId,
  });

  const lastBodyMap = new Map<string, string>();
  const unreadCountMap = new Map<string, number>();
  for (const p of (previews ?? []) as Array<{
    conversation_id: string;
    last_body: string | null;
    unread_count: number | string;
  }>) {
    // unread_count 는 BIGINT → supabase-js 에서 문자열로 올 수 있어 Number() 로 정규화
    if (p.last_body) lastBodyMap.set(p.conversation_id, p.last_body);
    unreadCountMap.set(p.conversation_id, Number(p.unread_count ?? 0));
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
