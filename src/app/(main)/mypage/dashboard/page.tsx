import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import DashboardKpis from '@/features/dashboard/components/DashboardKpis';

export const dynamic = 'force-dynamic';

export const metadata = { title: '대시보드 | Marié' };

interface KpiCounts {
  quotations: { total: number; sent: number; accepted: number; rejected: number; pending: number };
  contracts: { total: number; awaitingSig: number; signed: number; completed: number; cancelled: number };
  bookings: { upcoming: number; thisMonth: number; completed: number };
  settlements: { paid: number; pending: number; netReceived: number; netPending: number };
  revenue: { thisMonth: number; lastMonth: number; allTime: number };
}

async function loadKpis(profileId: string): Promise<KpiCounts> {
  const supabase = createServerQueryClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  // 견적
  const [qSent, qReceivedAccepted, qReceivedRejected, qReceivedPending] = await Promise.all([
    supabase.from('quotations').select('id, status', { count: 'exact', head: false })
      .eq('sender_profile_id', profileId).is('deleted_at', null),
    supabase.from('quotations').select('id', { count: 'exact', head: true })
      .eq('receiver_profile_id', profileId).eq('status', 'accepted').is('deleted_at', null),
    supabase.from('quotations').select('id', { count: 'exact', head: true })
      .eq('receiver_profile_id', profileId).eq('status', 'rejected').is('deleted_at', null),
    supabase.from('quotations').select('id', { count: 'exact', head: true })
      .eq('receiver_profile_id', profileId).in('status', ['sent', 'viewed']).is('deleted_at', null),
  ]);

  // 계약 — 양 당사자
  const [contractRows] = await Promise.all([
    supabase.from('contracts')
      .select('id, status, total_amount, completed_at')
      .or(`party_a_profile_id.eq.${profileId},party_b_profile_id.eq.${profileId}`)
      .is('deleted_at', null),
  ]);
  const contracts = (contractRows.data ?? []) as Array<{ id: string; status: string; total_amount: number; completed_at: string | null }>;

  const contractsByStatus = {
    total: contracts.length,
    awaitingSig: contracts.filter((c) => c.status === 'awaiting_signatures').length,
    signed: contracts.filter((c) => c.status === 'signed' || c.status === 'in_progress').length,
    completed: contracts.filter((c) => c.status === 'completed').length,
    cancelled: contracts.filter((c) => c.status === 'cancelled' || c.status === 'disputed').length,
  };

  // 매출 — completed 계약의 total_amount
  const revenueThisMonth = contracts
    .filter((c) => c.completed_at && c.completed_at >= monthStart && c.completed_at < monthEnd)
    .reduce((s, c) => s + c.total_amount, 0);
  const revenueLastMonth = contracts
    .filter((c) => c.completed_at && c.completed_at >= lastMonthStart && c.completed_at < monthStart)
    .reduce((s, c) => s + c.total_amount, 0);
  const revenueAllTime = contracts
    .filter((c) => c.completed_at).reduce((s, c) => s + c.total_amount, 0);

  // 예약 — provider가 본인
  const [bookingRows] = await Promise.all([
    supabase.from('bookings')
      .select('id, event_date, status')
      .eq('provider_profile_id', profileId)
      .is('deleted_at', null),
  ]);
  const bookings = (bookingRows.data ?? []) as Array<{ id: string; event_date: string; status: string }>;
  const bookingsKpis = {
    upcoming: bookings.filter((b) => b.event_date >= todayIso && b.status === 'scheduled').length,
    thisMonth: bookings.filter((b) => b.event_date >= monthStart.slice(0, 10) && b.event_date < monthEnd.slice(0, 10)).length,
    completed: bookings.filter((b) => b.status === 'completed').length,
  };

  // 정산 — 수령자가 본인
  const [settlementRows] = await Promise.all([
    supabase.from('settlements')
      .select('id, status, net_amount, paid_at')
      .eq('payee_profile_id', profileId)
      .is('deleted_at', null),
  ]);
  const settlements = (settlementRows.data ?? []) as Array<{ id: string; status: string; net_amount: number; paid_at: string | null }>;
  const settlementsKpis = {
    paid: settlements.filter((s) => s.status === 'paid').length,
    pending: settlements.filter((s) => ['pending', 'approved', 'processing'].includes(s.status)).length,
    netReceived: settlements.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.net_amount, 0),
    netPending: settlements.filter((s) => ['pending', 'approved', 'processing'].includes(s.status)).reduce((sum, s) => sum + s.net_amount, 0),
  };

  return {
    quotations: {
      total: qSent.count ?? 0,
      sent: qSent.count ?? 0,
      accepted: qReceivedAccepted.count ?? 0,
      rejected: qReceivedRejected.count ?? 0,
      pending: qReceivedPending.count ?? 0,
    },
    contracts: contractsByStatus,
    bookings: bookingsKpis,
    settlements: settlementsKpis,
    revenue: { thisMonth: revenueThisMonth, lastMonth: revenueLastMonth, allTime: revenueAllTime },
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile')?.value;
  if (!profileCookie) redirect(ROUTES.LOGIN);

  let profileId: string;
  try {
    profileId = JSON.parse(profileCookie).id;
    if (!profileId) throw new Error();
  } catch {
    redirect(ROUTES.LOGIN);
  }

  const kpis = await loadKpis(profileId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="대시보드"
        description="이번 달 거래 흐름과 누적 매출을 한눈에 확인합니다."
      />
      <DashboardKpis kpis={kpis} />
    </div>
  );
}
