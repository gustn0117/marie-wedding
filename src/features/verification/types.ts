import type { Profile, VerificationStatus } from '@/types/database';

export interface VerificationSubmitRequest {
  businessNumber: string;
  documentFile: File;
}

export type VerificationRow = Pick<Profile,
  | 'id'
  | 'contact_name'
  | 'company_name'
  | 'business_type'
  | 'business_number'
  | 'verification_status'
  | 'verification_document'
  | 'verification_submitted_at'
  | 'verification_reject_reason'
>;

export type { VerificationStatus };
