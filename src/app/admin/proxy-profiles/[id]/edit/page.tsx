import AdminProxyProfileEditClient from './AdminProxyProfileEditClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대행 프로필 수정 | 관리자' };

export default async function AdminProxyProfileEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminProxyProfileEditClient profileId={id} />;
}
