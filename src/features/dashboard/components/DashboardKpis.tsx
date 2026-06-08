import Link from 'next/link';
import { ROUTES } from '@/shared/constants';

interface KpiProps {
  kpis: {
    quotations: { total: number; sent: number; accepted: number; rejected: number; pending: number };
    contracts: { total: number; awaitingSig: number; signed: number; completed: number; cancelled: number };
    bookings: { upcoming: number; thisMonth: number; completed: number };
    settlements: { paid: number; pending: number; netReceived: number; netPending: number };
    revenue: { thisMonth: number; lastMonth: number; allTime: number };
  };
}

export default function DashboardKpis({ kpis }: KpiProps) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const acceptRate = kpis.quotations.sent > 0
    ? Math.round((kpis.quotations.accepted / kpis.quotations.sent) * 100)
    : 0;
  const revenueDiff = kpis.revenue.thisMonth - kpis.revenue.lastMonth;
  const revenueDiffPercent = kpis.revenue.lastMonth > 0
    ? Math.round((revenueDiff / kpis.revenue.lastMonth) * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* 매출 — 최상위 강조, .surface 토큰 */}
      <section className="surface p-6">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <p className="section-eyebrow !mb-1">이번 달 매출 (계약 총액)</p>
            <p className="text-[32px] font-extrabold text-ink tabular-nums leading-none tracking-tighter">
              {fmt(kpis.revenue.thisMonth)}
              <span className="text-base font-bold text-gray-400 ml-1.5">KRW</span>
            </p>
            {revenueDiffPercent !== null && (
              <p className={`mt-1.5 text-[13px] font-semibold ${revenueDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {revenueDiff >= 0 ? '↑' : '↓'} 전월 대비 {Math.abs(revenueDiffPercent)}%
                <span className="text-gray-400 font-medium ml-1">({fmt(Math.abs(revenueDiff))} KRW)</span>
              </p>
            )}
          </div>
          <Link href={ROUTES.CONTRACTS} className="shrink-0 text-xs text-gray-500 hover:text-ink font-bold inline-flex items-center gap-1">
            계약 보기
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">전월</p>
            <p className="mt-0.5 text-[15px] font-bold text-ink tabular-nums">
              {fmt(kpis.revenue.lastMonth)} <span className="text-[11px] text-gray-400">KRW</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">누적</p>
            <p className="mt-0.5 text-[15px] font-bold text-ink tabular-nums">
              {fmt(kpis.revenue.allTime)} <span className="text-[11px] text-gray-400">KRW</span>
            </p>
          </div>
        </div>
      </section>

      {/* 거래 4 단계 KPI — .stat 토큰 */}
      <section>
        <p className="section-eyebrow">거래 흐름</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="견적 (받은)"
            primaryValue={kpis.quotations.pending}
            primaryUnit="건 대기"
            href={`${ROUTES.QUOTATIONS}?tab=received`}
            details={[
              { label: '승인률', value: `${acceptRate}%`, tone: acceptRate >= 50 ? 'positive' : 'neutral' },
              { label: '승인', value: `${kpis.quotations.accepted}건` },
              { label: '거절', value: `${kpis.quotations.rejected}건`, tone: 'negative' },
            ]}
          />
          <KpiCard
            label="계약"
            primaryValue={kpis.contracts.awaitingSig}
            primaryUnit="건 서명 대기"
            href={ROUTES.CONTRACTS}
            details={[
              { label: '진행 중', value: `${kpis.contracts.signed}건` },
              { label: '완료', value: `${kpis.contracts.completed}건`, tone: 'positive' },
              { label: '취소', value: `${kpis.contracts.cancelled}건`, tone: 'negative' },
            ]}
          />
          <KpiCard
            label="예약·일정"
            primaryValue={kpis.bookings.upcoming}
            primaryUnit="건 예정"
            href={ROUTES.BOOKINGS}
            details={[
              { label: '이번 달', value: `${kpis.bookings.thisMonth}건` },
              { label: '완료', value: `${kpis.bookings.completed}건`, tone: 'positive' },
            ]}
          />
          <KpiCard
            label="정산"
            primaryValue={kpis.settlements.pending}
            primaryUnit="건 진행"
            href={ROUTES.SETTLEMENTS}
            details={[
              { label: '받을 금액', value: `${fmt(kpis.settlements.netPending)} KRW`, tone: 'warning' },
              { label: '받은 금액', value: `${fmt(kpis.settlements.netReceived)} KRW`, tone: 'positive' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

const TONES: Record<string, string> = {
  positive: 'text-emerald-700',
  negative: 'text-rose-600',
  warning: 'text-amber-700',
  neutral: 'text-gray-700',
};

function KpiCard({
  label,
  primaryValue,
  primaryUnit,
  href,
  details,
}: {
  label: string;
  primaryValue: number;
  primaryUnit: string;
  href: string;
  details: { label: string; value: string; tone?: keyof typeof TONES }[];
}) {
  return (
    <Link href={href} className="stat hover:border-gray-300 transition-colors group">
      <p className="stat-label">{label}</p>
      <p className="stat-value mb-1 group-hover:text-primary transition-colors">
        {primaryValue.toLocaleString()}
      </p>
      <p className="text-xs text-gray-500 mb-3">{primaryUnit}</p>
      <ul className="space-y-1 pt-3 border-t border-gray-100">
        {details.map((d) => (
          <li key={d.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{d.label}</span>
            <span className={`font-bold tabular-nums ${TONES[d.tone ?? 'neutral']}`}>{d.value}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
