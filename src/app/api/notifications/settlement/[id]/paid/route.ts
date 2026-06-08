import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { sendEmail } from '@/features/notifications/lib/email';
import { settlementPaidEmail } from '@/features/notifications/lib/templates';

export const dynamic = 'force-dynamic';

/**
 * 정산 완료 알림 — admin이 mark_paid 후 호출.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServerQueryClient();
  const { data, error } = await supabase
    .from('settlements')
    .select(`
      id, status, net_amount, paid_at,
      contract:contracts(title),
      payee:profiles!payee_profile_id(company_name, contact_name, user_id)
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'not_found' }, { status: 404 });
  if (data.status !== 'paid') return NextResponse.json({ error: 'not_paid' }, { status: 400 });

  const { createServiceClient } = await import('@/lib/supabase/service');
  const svc = createServiceClient();

  const payee = Array.isArray(data.payee) ? data.payee[0] : data.payee;
  const contract = Array.isArray(data.contract) ? data.contract[0] : data.contract;
  const userId = payee?.user_id;
  if (!userId) return NextResponse.json({ ok: true, skipped: 'no_user' });

  const { data: u } = await svc.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (!email) return NextResponse.json({ ok: true, skipped: 'no_email' });

  const tpl = settlementPaidEmail({
    payeeName: payee?.company_name || payee?.contact_name || '수령자',
    title: contract?.title ?? '계약',
    netAmount: data.net_amount,
    paidAt: data.paid_at ? new Date(data.paid_at).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR'),
    settlementId: data.id,
  });
  const result = await sendEmail({ to: email, ...tpl });
  return NextResponse.json(result);
}
