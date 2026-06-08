import { createServerQueryClient } from '@/lib/supabase/server-query';
import VerificationAdminTable from '@/features/admin/components/VerificationAdminTable';
import type { VerificationRow } from '@/features/verification/types';

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
    <main className="mx-auto max-w-[1200px] space-y-4">
      <header className="platform-panel p-5">
        <p className="platform-eyebrow">관리자</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">업체 인증 검토</h1>
        <p className="mt-2 text-sm text-gray-600">
          제출된 사업자등록증과 사업자번호를 확인하고 승인/거절을 결정합니다.
        </p>
      </header>
      <section className="platform-panel p-5">
        <VerificationAdminTable rows={(rows ?? []) as VerificationRow[]} />
      </section>
    </main>
  );
}
