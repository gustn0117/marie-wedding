import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import SavedSearchTable from '@/features/saved-searches/components/SavedSearchTable';
import PageHeader from '@/shared/components/PageHeader';
import type { SavedSearch } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function SavedSearchesPage() {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get('marie_profile');
  if (!profileCookie?.value) redirect(ROUTES.LOGIN);

  let me: { id: string } | null = null;
  try { me = JSON.parse(profileCookie.value); } catch { redirect(ROUTES.LOGIN); }
  if (!me?.id) redirect(ROUTES.LOGIN);

  const supabase = createServerQueryClient();
  const { data } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('profile_id', me.id)
    .order('created_at', { ascending: false });

  return (
    <main className="space-y-4">
      <PageHeader
        eyebrow="저장된 검색"
        title="저장한 검색"
        description="자주 쓰는 조건을 저장해 한 번에 다시 보기. 검색 결과 페이지 우상단에서 저장할 수 있습니다."
      />

      <section className="platform-panel p-5">
        <SavedSearchTable items={(data ?? []) as SavedSearch[]} />
      </section>
    </main>
  );
}
