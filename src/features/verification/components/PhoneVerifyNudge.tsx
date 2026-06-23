import Link from 'next/link';

interface Props {
  /** 휴대폰 인증 완료 여부 (profile.phone_verified) */
  phoneVerified: boolean;
  /** 노출 컨텍스트별 분기 — 마이페이지 vs 지원 전 (다른 문구) */
  context?: 'mypage' | 'apply' | 'message';
}

/**
 * 휴대폰 인증 권유 배너.
 * 이미 인증된 사용자에게는 렌더링 안 함.
 */
export default function PhoneVerifyNudge({ phoneVerified, context = 'mypage' }: Props) {
  if (phoneVerified) return null;

  const copy: Record<NonNullable<Props['context']>, { title: string; description: string }> = {
    mypage: {
      title: '휴대폰 인증을 완료하면 신뢰 등급이 올라가요',
      description: '본인 명의 번호로 6자리 인증번호만 입력하면 끝. 채용·지원 응답률에 직접 영향을 줍니다.',
    },
    apply: {
      title: '지원하기 전, 휴대폰 인증을 완료해 주세요',
      description: '인증된 지원자는 업체가 우선적으로 검토합니다. 1분이면 완료됩니다.',
    },
    message: {
      title: '쪽지를 더 잘 받으려면 휴대폰 인증',
      description: '인증된 회원에게 업체가 더 자주 응답합니다.',
    },
  };
  const { title, description } = copy[context];

  return (
    <Link
      href="/mypage/phone-verification"
      className="group flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/60 p-4 hover:bg-primary-50 transition-colors"
    >
      <div className="shrink-0 inline-flex w-10 h-10 items-center justify-center rounded-full bg-primary text-white">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs text-gray-600 leading-snug">{description}</p>
      </div>
      <svg className="shrink-0 w-5 h-5 text-primary group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
