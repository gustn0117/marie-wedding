import AdminTrafficClient from './AdminTrafficClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유입 통계 | 관리자' };

export default function AdminTrafficPage() {
  return <AdminTrafficClient />;
}
