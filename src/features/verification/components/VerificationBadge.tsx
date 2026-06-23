import Badge from '@/shared/components/Badge';
import type { VerificationStatus } from '@/types/database';
import { VERIFICATION_BADGE_LABEL } from '@/shared/constants';

interface Props {
  verificationStatus: VerificationStatus | null | undefined;
  /** @deprecated 휴대폰 인증 기능 제거됨. 호출자 호환을 위해 prop 만 남김. */
  phoneVerified?: boolean | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function VerificationBadge({ verificationStatus, phoneVerified }: Props) {
  if (verificationStatus === 'verified') {
    return <Badge kind="verified"><svg className="w-3 h-3 inline mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{VERIFICATION_BADGE_LABEL}</Badge>;
  }
  return null;
}
