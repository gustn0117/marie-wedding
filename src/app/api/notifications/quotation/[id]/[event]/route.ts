import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { sendEmail } from '@/features/notifications/lib/email';
import { quotationRespondedEmail, quotationSentEmail } from '@/features/notifications/lib/templates';

export const dynamic = 'force-dynamic';

const ALLOWED_EVENTS = ['sent', 'accepted', 'rejected'] as const;
type QuotationEvent = (typeof ALLOWED_EVENTS)[number];

/**
 * 견적 알림 디스패처.
 * 클라이언트가 transitionStatus RPC 호출 성공 후 fire-and-forget으로 호출.
 * RLS가 양 당사자만 SELECT 허용하므로 자체 권한 검증 (쿠키 ID가 sender/receiver 중 하나).
 */
export async function POST(req: Request, { params }: { params: { id: string; event: string } }) {
  if (!ALLOWED_EVENTS.includes(params.event as QuotationEvent)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }
  const event = params.event as QuotationEvent;

  // 인증
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let callerId: string;
  try { callerId = JSON.parse(profileCookie).id; if (!callerId) throw new Error(); }
  catch { return NextResponse.json({ error: 'invalid_session' }, { status: 401 }); }

  const supabase = createServerQueryClient();

  // 견적 + 양 당사자의 user.email 조회 (auth.users 조인은 service 키 필요)
  const { data, error } = await supabase
    .from('quotations')
    .select(`
      id, title, total_amount, event_date, valid_until, status, rejection_reason,
      sender_profile_id, receiver_profile_id,
      sender:profiles!sender_profile_id(company_name, contact_name, user_id),
      receiver:profiles!receiver_profile_id(company_name, contact_name, user_id)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'not_found' }, { status: 404 });
  }

  // 권한: 양 당사자만
  if (callerId !== data.sender_profile_id && callerId !== data.receiver_profile_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 수신자(메일 받을 사람)의 이메일 조회. supabase admin API 필요 → service 사용.
  const { createServiceClient } = await import('@/lib/supabase/service');
  const svc = createServiceClient();

  const sender = Array.isArray(data.sender) ? data.sender[0] : data.sender;
  const receiver = Array.isArray(data.receiver) ? data.receiver[0] : data.receiver;
  const senderName = sender?.company_name || sender?.contact_name || '발신자';
  const receiverName = receiver?.company_name || receiver?.contact_name || '수신자';

  async function getEmail(userId: string | null | undefined): Promise<string | null> {
    if (!userId) return null;
    const { data: u } = await svc.auth.admin.getUserById(userId);
    return u?.user?.email ?? null;
  }

  if (event === 'sent') {
    // 발송: 수신자에게 메일
    const to = await getEmail(receiver?.user_id);
    if (!to) return NextResponse.json({ ok: true, skipped: 'no_receiver_email' });
    const tpl = quotationSentEmail({
      receiverName, senderName,
      title: data.title,
      totalAmount: data.total_amount,
      eventDate: data.event_date,
      validUntil: data.valid_until,
      quotationId: data.id,
    });
    const result = await sendEmail({ to, ...tpl });
    return NextResponse.json(result);
  }

  // accepted / rejected: 발신자에게 메일
  const to = await getEmail(sender?.user_id);
  if (!to) return NextResponse.json({ ok: true, skipped: 'no_sender_email' });
  const tpl = quotationRespondedEmail({
    senderName, receiverName,
    title: data.title,
    status: event,
    reason: event === 'rejected' ? data.rejection_reason : null,
    quotationId: data.id,
  });
  const result = await sendEmail({ to, ...tpl });
  return NextResponse.json(result);
}
