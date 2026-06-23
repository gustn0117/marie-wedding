import { cookies } from 'next/headers';
import AdminLayoutClient from './AdminLayoutClient';
import AdminPasswordGate from './AdminPasswordGate';

export const dynamic = 'force-dynamic';

/**
 * /admin 진입 게이트.
 * - 로그인 X. marie_admin_unlock 쿠키만으로 통과/차단.
 * - 쿠키 없으면 비밀번호 폼만 노출.
 * - 쿠키 있으면 기존 사이드바 + children.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const unlocked = cookieStore.get('marie_admin_unlock')?.value === '1';

  if (!unlocked) {
    return <AdminPasswordGate />;
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
