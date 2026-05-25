import Link from 'next/link';
import type { Profile } from '@/types/database';
import { VERIFICATION_STATUS_LABELS } from '@/shared/constants';

interface Props {
  profile: Pick<Profile, 'account_type' | 'verification_status' | 'phone_verified'>;
}

export default function VerificationStatusPanel({ profile }: Props) {
  const isBusiness = profile.account_type === 'business';
  const status = profile.verification_status;
  const label = VERIFICATION_STATUS_LABELS[status];
  const verified = status === 'verified';
  const cta = verified ? '인증 정보' : status === 'pending' ? '검토 상태' : '인증 신청';

  return (
    <section className="platform-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">신뢰 상태</h2>
        {isBusiness && (
          <Link
            href="/mypage/verification"
            className="text-xs font-bold text-primary hover:underline"
          >
            {cta} →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">업체 인증</p>
          <p className="text-sm font-bold text-gray-900">{isBusiness ? label : '해당 없음'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">본인 확인</p>
          <p className="text-sm font-bold text-gray-900">{profile.phone_verified ? '완료' : '미완료'}</p>
        </div>
      </div>
    </section>
  );
}
