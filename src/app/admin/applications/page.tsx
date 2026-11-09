import { Suspense } from 'react';
import AdminApplicationsClient from './AdminApplicationsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '지원 현황 | 관리자' };

export default function AdminApplicationsPage() {
  return (
    <Suspense fallback={<div className="platform-panel p-10 text-center text-sm text-gray-400">불러오는 중…</div>}>
      <AdminApplicationsClient />
    </Suspense>
  );
}
