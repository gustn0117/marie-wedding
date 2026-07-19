import AdminMailClient from './AdminMailClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '메일 | 관리자' };

export default function AdminMailPage() {
  return <AdminMailClient />;
}
