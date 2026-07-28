import AdminProfileEditClient from './AdminProfileEditClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '회원 프로필 수정 | 관리자' };

export default async function AdminProfileEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminProfileEditClient profileId={id} />;
}
