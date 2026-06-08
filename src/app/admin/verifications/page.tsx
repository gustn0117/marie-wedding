import { createServerQueryClient } from '@/lib/supabase/server-query';
import VerificationAdminTable from '@/features/admin/components/VerificationAdminTable';
import type { VerificationRow } from '@/features/verification/types';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage() {
  const supabase = createServerQueryClient();
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, contact_name, company_name, business_type, business_number, verification_status, verification_document, verification_submitted_at, verification_reject_reason')
    .eq('verification_status', 'pending')
    .is('deleted_at', null)
    .order('verification_submitted_at', { ascending: true });

  return (
    <main className="space-y-4">
      <PageHeader
        eyebrow="관리자"
        title="업체 인증 검토"
        description="제출된 사업자등록증과 사업자번호를 확인하고 승인/거절을 결정합니다."
      />
      <section className="surface p-5">
        <VerificationAdminTable rows={(rows ?? []) as VerificationRow[]} />
      </section>
    </main>
  );
}
