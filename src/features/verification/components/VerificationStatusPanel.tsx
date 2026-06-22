import Link from 'next/link';
import type { Profile } from '@/types/database';

interface Props {
  profile: Pick<Profile, 'account_type' | 'verification_status' | 'phone_verified'>;
}

type RowState = 'verified' | 'pending' | 'rejected' | 'none' | 'na';

export default function VerificationStatusPanel({ profile }: Props) {
  const isBusiness = profile.account_type === 'business';
  const businessStatus: RowState = !isBusiness
    ? 'na'
    : profile.verification_status === 'verified'
      ? 'verified'
      : profile.verification_status === 'pending'
        ? 'pending'
        : profile.verification_status === 'rejected'
          ? 'rejected'
          : 'none';
  const phoneStatus: RowState = profile.phone_verified ? 'verified' : 'none';

  return (
    <section className="platform-panel p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-3">신뢰 상태</h2>
      <ul className="grid gap-2.5">
        <StatusRow
          title="사업자 인증"
          subtitle="사업자등록증을 제출해 업체임을 증명합니다."
          state={businessStatus}
          href="/mypage/verification"
          cta={ctaForBusiness(businessStatus)}
        />
        <StatusRow
          title="휴대폰 본인인증"
          subtitle="실명·연락처가 확인된 회원에게 '실명 확인' 배지가 노출됩니다."
          state={phoneStatus}
          href="/mypage/phone-verification"
          cta={phoneStatus === 'verified' ? '인증 정보 보기' : '본인인증 하기'}
        />
      </ul>
    </section>
  );
}

function ctaForBusiness(state: RowState): string {
  switch (state) {
    case 'na': return '';
    case 'verified': return '인증 정보 보기';
    case 'pending': return '검토 진행 중';
    case 'rejected': return '다시 신청하기';
    default: return '인증 신청하기';
  }
}

function StatusRow({
  title,
  subtitle,
  state,
  href,
  cta,
}: {
  title: string;
  subtitle: string;
  state: RowState;
  href: string;
  cta: string;
}) {
  const dot = STATE_DOT[state];
  const statusLabel = STATE_LABEL[state];
  const showLink = state !== 'na' && state !== 'pending';

  return (
    <li className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      {/* 좌측: 상태 점 */}
      <span
        className={`shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center ${dot.wrap}`}
        aria-hidden
      >
        {dot.icon}
      </span>

      {/* 가운데: 제목 + 상태 + 부제 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13.5px] font-bold text-ink truncate">{title}</p>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${STATE_BADGE[state]}`}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-gray-500 leading-relaxed truncate">{subtitle}</p>
      </div>

      {/* 우측: CTA */}
      {showLink && cta && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded-lg border border-gray-200 bg-white text-[12px] font-semibold text-gray-700 hover:border-ink hover:text-ink transition-colors"
        >
          {cta}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      )}
      {state === 'pending' && (
        <span className="shrink-0 text-[12px] font-semibold text-amber-700">검토 중</span>
      )}
    </li>
  );
}

const STATE_DOT: Record<RowState, { wrap: string; icon: React.ReactNode }> = {
  verified: {
    wrap: 'bg-ink text-white',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
  },
  pending: {
    wrap: 'bg-amber-100 text-amber-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  rejected: {
    wrap: 'bg-rose-100 text-rose-700',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  none: {
    wrap: 'bg-gray-100 text-gray-500',
    icon: <span className="block w-1.5 h-1.5 rounded-full bg-current" />,
  },
  na: {
    wrap: 'bg-gray-50 text-gray-300',
    icon: <span className="block w-1.5 h-1.5 rounded-full bg-current" />,
  },
};

const STATE_LABEL: Record<RowState, string> = {
  verified: '인증 완료',
  pending: '검토 중',
  rejected: '재신청 필요',
  none: '미인증',
  na: '해당 없음',
};

const STATE_BADGE: Record<RowState, string> = {
  verified: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  rejected: 'bg-rose-50 text-rose-700',
  none: 'bg-gray-100 text-gray-500',
  na: 'bg-gray-50 text-gray-400',
};
