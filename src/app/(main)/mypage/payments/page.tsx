import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';
import EmptyState from '@/shared/components/EmptyState';

export const dynamic = 'force-dynamic';

export const metadata = { title: '결제 내역 | Marié' };

const PRODUCT_LABELS: Record<string, string> = {
  premium_tier: '프리미엄 등급',
  job_promotion: '공고 추천 노출',
  event_listing: '이벤트 등록',
  directory_boost: '디렉토리 부스트',
};

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  refunded: 'bg-blue-50 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '결제 대기',
  completed: '결제 완료',
  failed: '실패',
  cancelled: '취소',
  refunded: '환불',
};

export default async function PaymentsHistoryPage({ searchParams }: { searchParams: { paid?: string } }) {
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

  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50);

  const payments = data ?? [];
  const justPaid = searchParams.paid;
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  return (
    <div className="space-y-4">
      <PageHeader
        title="결제 내역"
        description="최근 결제와 처리 상태를 확인합니다."
        actions={
          <Link href="/pricing" className="btn-outline text-sm">프리미엄 플랜 보기</Link>
        }
      />

      {justPaid && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-700">
            <span className="font-bold">결제 요청 완료</span> — 결제 게이트웨이에서 확인이 완료되면 상태가 자동으로 업데이트됩니다.
          </p>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          title="결제 내역이 없습니다"
          description="프리미엄 등급으로 업그레이드하면 더 많은 거래 기회를 누릴 수 있습니다."
          actionLabel="프리미엄 플랜 보기"
          actionHref="/pricing"
        />
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {payments.map((p) => (
            <li key={p.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded text-[11px] px-2 py-0.5 font-bold border ${STATUS_TONES[p.status] || ''}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                    <span className="text-xs text-gray-400">{PRODUCT_LABELS[p.product_type] || p.product_type}</span>
                  </div>
                  <p className="text-sm font-semibold text-ink truncate">
                    {(p.metadata as { tier?: string; cycle?: string })?.tier && `${(p.metadata as { tier?: string }).tier} `}
                    {(p.metadata as { cycle?: string })?.cycle && `(${(p.metadata as { cycle?: string }).cycle === 'yearly' ? '연간' : '월간'})`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-ink tabular-nums">
                    {fmt(p.amount)} <span className="text-xs text-gray-500">{p.currency}</span>
                  </p>
                  <p className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleString('ko-KR')}</p>
                </div>
              </div>
              {p.gateway_transaction_id && (
                <p className="text-[10px] text-gray-400 mt-1">거래번호: {p.gateway_transaction_id}</p>
              )}
              {(p.metadata as { receiptUrl?: string })?.receiptUrl && (
                <a href={(p.metadata as { receiptUrl: string }).receiptUrl} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline">
                  영수증 보기 →
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
