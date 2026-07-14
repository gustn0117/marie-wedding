import { createServerQueryClient } from '@/lib/supabase/server-query';
import { hasValidAdminSession } from '@/lib/admin-session';
import { redirect } from 'next/navigation';
import VerificationAdminTable from '@/features/admin/components/VerificationAdminTable';
import type { VerificationRow } from '@/features/verification/types';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage() {
  // 상위 layout이 클라이언트 이동 중 재사용돼도 만료된 관리자 세션으로
  // 사업자번호·비공개 인증서 경로를 읽을 수 없게 페이지에서 다시 검증한다.
  if (!await hasValidAdminSession()) redirect('/admin');

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
