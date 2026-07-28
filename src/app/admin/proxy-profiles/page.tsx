import AdminProxyProfilesClient from './AdminProxyProfilesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대행 등록 프로필 | 관리자' };

export default function AdminProxyProfilesPage() {
  return <AdminProxyProfilesClient />;
}
