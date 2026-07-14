import { createServiceClient } from '@/lib/supabase/service';
import type { User } from '@supabase/supabase-js';

/**
 * auth.users 에서 이메일로 사용자 조회 (service_role, 페이지네이션).
 * 자체 인스턴스라 사용자 수가 적어 전수 조회로 충분하다.
 */
export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const supabase = createServiceClient();
  const target = email.trim().toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
    if (page > 20) return null; // 안전장치
  }
}
