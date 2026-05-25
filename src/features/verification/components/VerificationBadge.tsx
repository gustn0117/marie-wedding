import Badge from '@/shared/components/Badge';
import type { VerificationStatus } from '@/types/database';
import { VERIFICATION_BADGE_LABEL, PHONE_VERIFIED_BADGE_LABEL } from '@/shared/constants';

interface Props {
  verificationStatus: VerificationStatus | null | undefined;
  phoneVerified?: boolean | null;
}

export default function VerificationBadge({ verificationStatus, phoneVerified }: Props) {
  if (verificationStatus === 'verified') {
    return <Badge kind="verified">✓ {VERIFICATION_BADGE_LABEL}</Badge>;
  }
  if (phoneVerified) {
    return <Badge kind="attr">{PHONE_VERIFIED_BADGE_LABEL}</Badge>;
  }
  return null;
}
