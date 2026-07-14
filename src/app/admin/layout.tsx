import AdminLayoutClient from './AdminLayoutClient';
import AdminPasswordGate from './AdminPasswordGate';
import { hasValidAdminSession } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

/**
 * /admin 진입 게이트.
 * - 로그인 X. HMAC 서명된 관리자 세션 쿠키로 통과/차단.
 * - 쿠키 없으면 비밀번호 폼만 노출.
 * - 쿠키 있으면 기존 사이드바 + children.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const unlocked = await hasValidAdminSession();

  if (!unlocked) {
    return <AdminPasswordGate />;
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
