import { createServerQueryClient } from '@/lib/supabase/server-query';

export interface ConversationSummary {
  id: string;
  partnerName: string;
  partnerImage: string | null;
  lastBody: string | null;
  lastMessageAt: string;
  unread: number;
}

/**
 * 내 대화 목록 요약(상대 이름/사진 · 마지막 메시지 · 안읽음 수)을 서버에서 집계한다.
 *
 * - 서버 컴포넌트에서 호출 → 내부 kong 직결이라 빠르고, 클라이언트 토큰 초기화·
 *   Cloudflare 왕복이 없다. 결과를 사이드바/목록에 초기 데이터로 넘겨 즉시 렌더한다.
 * - 존재하지 않던 get_conversation_previews RPC 의존을 제거하고 일반 쿼리로 집계한다.
 * - 마지막 메시지 body 조회는 최근 300건으로 유계(대화·메시지가 쌓여도 전송량 제한).
 *   활성 대화의 마지막 메시지는 항상 최근이라 포함된다.
 */
export async function loadConversationSummaries(myId: string): Promise<ConversationSummary[]> {
  const supabase = createServerQueryClient();

  const { data: convs } = await supabase
    .from('conversations')
    .select('id, participant_a, participant_b, last_message_at')
    .or(`participant_a.eq.${myId},participant_b.eq.${myId}`)
    .order('last_message_at', { ascending: false })
    .limit(50);

  const list = (convs ?? []) as Array<{ id: string; participant_a: string; participant_b: string; last_message_at: string }>;
  if (list.length === 0) return [];

  const partnerIds = Array.from(new Set(list.map((c) => (c.participant_a === myId ? c.participant_b : c.participant_a))));
  const convIds = list.map((c) => c.id);

  const [partnersRes, lastMsgsRes, unreadRes] = await Promise.all([
    supabase.from('profiles').select('id, company_name, contact_name, profile_image, deleted_at').in('id', partnerIds),
    supabase.from('messages').select('conversation_id, body, created_at').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(300),
    supabase.from('messages').select('conversation_id').in('conversation_id', convIds).is('read_at', null).neq('sender_id', myId),
  ]);

  const partnerMap = new Map<string, { name: string; image: string | null }>();
  for (const p of (partnersRes.data ?? []) as Array<{ id: string; company_name: string | null; contact_name: string | null; profile_image: string | null; deleted_at: string | null }>) {
    partnerMap.set(p.id, {
      // 탈퇴 상대 실명/사진 마스킹 — 대화는 유지하되 노출은 숨김
      name: p.deleted_at ? '탈퇴한 회원' : (p.company_name || p.contact_name || '알 수 없음'),
      image: p.deleted_at ? null : p.profile_image,
    });
  }

  const lastBodyMap = new Map<string, string>();
  for (const m of (lastMsgsRes.data ?? []) as Array<{ conversation_id: string; body: string }>) {
    if (!lastBodyMap.has(m.conversation_id)) lastBodyMap.set(m.conversation_id, m.body);
  }

  const unreadMap = new Map<string, number>();
  for (const m of (unreadRes.data ?? []) as Array<{ conversation_id: string }>) {
    unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) ?? 0) + 1);
  }

  return list.map((c) => {
    const partnerId = c.participant_a === myId ? c.participant_b : c.participant_a;
    const meta = partnerMap.get(partnerId) ?? { name: '알 수 없음', image: null };
    return {
      id: c.id,
      partnerName: meta.name,
      partnerImage: meta.image,
      lastBody: lastBodyMap.get(c.id) ?? null,
      lastMessageAt: c.last_message_at,
      unread: unreadMap.get(c.id) ?? 0,
    };
  });
}
