import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import type { Application, Job, Profile } from '@/types/database';

interface Props {
  profileId: string;
}

type AppWithJob = Application & {
  job?: Pick<Job, 'id' | 'title' | 'author_id' | 'business_type'> | null;
  applicant?: Pick<Profile, 'id' | 'company_name' | 'contact_name'> | null;
};

async function load(profileId: string) {
  const supabase = createServerQueryClient();
  const baseSelect = '*, job:jobs!inner(id, title, author_id, business_type), applicant:profiles(id, company_name, contact_name)';

  const [asApplicantRes, asAuthorRes, myReviewsRes] = await Promise.all([
    supabase
      .from('applications')
      .select(baseSelect)
      .is('deleted_at', null)
      .not('hiring_completed_at', 'is', null)
      .not('applicant_completed_at', 'is', null)
      .eq('applicant_id', profileId),
    supabase
      .from('applications')
      .select(baseSelect)
      .is('deleted_at', null)
      .not('hiring_completed_at', 'is', null)
      .not('applicant_completed_at', 'is', null)
      .eq('job.author_id', profileId),
    supabase
      .from('reviews')
      .select('application_id')
      .eq('reviewer_id', profileId)
      .is('deleted_at', null),
  ]);

  const reviewedSet = new Set(((myReviewsRes.data ?? []) as Array<{ application_id: string }>).map((r) => r.application_id));
  const all: AppWithJob[] = [
    ...(((asApplicantRes.data ?? []) as AppWithJob[])),
    ...(((asAuthorRes.data ?? []) as AppWithJob[])),
  ];
  // dedupe by id (same application may appear in both if self-applied — shouldn't happen but safety)
  const seen = new Set<string>();
  const unique = all.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  const pending = unique.filter((a) => !reviewedSet.has(a.id));
  pending.sort((a, b) => {
    const ad = Math.max(new Date(a.hiring_completed_at!).getTime(), new Date(a.applicant_completed_at!).getTime());
    const bd = Math.max(new Date(b.hiring_completed_at!).getTime(), new Date(b.applicant_completed_at!).getTime());
    return bd - ad;
  });
  return pending.slice(0, 5);
}

export default async function PendingReviewsSection({ profileId }: Props) {
  const pending = await load(profileId);
  if (pending.length === 0) return null;

  return (
    <section className="platform-panel p-5 border-l-4 border-l-primary">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">검토 대기</p>
          <h2 className="text-sm font-bold text-gray-900 mt-1">후기 작성 대기 ({pending.length})</h2>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">거래 완료 후 30일 이내 리뷰를 남겨주세요. 누적된 태그가 카드와 프로필에 노출됩니다.</p>
      <ul className="divide-y divide-gray-100">
        {pending.map((item) => {
          const isApplicant = item.applicant_id === profileId;
          const counterpartName = isApplicant
            ? '공고 작성자'
            : (item.applicant?.company_name || item.applicant?.contact_name || '지원자');
          return (
            <li key={item.id}>
              <Link
                href={`/applications/${item.id}/review`}
                className="flex items-center justify-between gap-3 py-3 hover:bg-primary-50/40 -mx-3 px-3 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 group-hover:text-primary truncate">
                    {item.job?.title ?? '공고'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">상대: {counterpartName}</p>
                </div>
                <span className="shrink-0 rounded border border-primary bg-primary px-3 py-1.5 text-[11px] font-bold text-white">
                  리뷰 작성 →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
