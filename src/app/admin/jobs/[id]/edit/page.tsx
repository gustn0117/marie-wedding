import AdminJobEditClient from './AdminJobEditClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '공고 수정 | 관리자' };

export default async function AdminJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminJobEditClient jobId={id} />;
}
