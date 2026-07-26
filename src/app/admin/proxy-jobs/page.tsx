import AdminProxyJobsClient from './AdminProxyJobsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대행 등록 공고 | 관리자' };

export default function AdminProxyJobsPage() {
  return <AdminProxyJobsClient />;
}
