import Badge from '@/shared/components/Badge';
import type { VerificationStatus } from '@/types/database';
import { VERIFICATION_BADGE_LABEL, PHONE_VERIFIED_BADGE_LABEL } from '@/shared/constants';

interface Props {
  verificationStatus: VerificationStatus | null | undefined;
  phoneVerified?: boolean | null;
}

export default function VerificationBadge({ verificationStatus, phoneVerified }: Props) {
  if (verificationStatus === 'verified') {
    return <Badge kind="verified"><svg className="w-3 h-3 inline mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{VERIFICATION_BADGE_LABEL}</Badge>;
  }
  if (phoneVerified) {
    return <Badge kind="attr">{PHONE_VERIFIED_BADGE_LABEL}</Badge>;
  }
  return null;
}
