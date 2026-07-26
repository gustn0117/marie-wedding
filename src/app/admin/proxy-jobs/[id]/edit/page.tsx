import AdminProxyJobEditClient from './AdminProxyJobEditClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대행 공고 수정 | 관리자' };

export default async function AdminProxyJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminProxyJobEditClient jobId={id} />;
}
