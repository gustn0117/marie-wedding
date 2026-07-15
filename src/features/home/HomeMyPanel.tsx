import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { type Profile } from '@/types/database';

interface Props {
  profileId: string;
}

interface Metrics {
  unreadNotifications: number;
  pendingReceived: number;
  pendingReviews: number;
  unreadMessages: number;
  myJobs: number;
}

async function loadProfile(profileId: string): Promise<Profile | null> {
  const sb = createServerQueryClient();
  const { data } = await sb
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data ?? null) as Profile | null;
}

async function loadMetrics(profileId: string): Promise<Metrics> {
  const sb = createServerQueryClient();
  const [unreadNotif, recvAll, myJobs, myReviewsRes, dealsRes] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId).is('read_at', null).is('deleted_at', null),
    sb.from('applications').select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .in('status', ['pending', 'reviewing'])
      .filter('job_id', 'in', `(SELECT id FROM marie_wedding.jobs WHERE author_id = '${profileId}' AND deleted_at IS NULL)`),
    sb.from('jobs').select('id', { count: 'exact', head: true })
      .eq('author_id', profileId).is('deleted_at', null),
    sb.from('reviews').select('application_id').eq('reviewer_id', profileId).is('deleted_at', null),
    sb.from('applications').select('id, applicant_id, job_id, hiring_completed_at, applicant_completed_at, job:jobs!inner(author_id)')
      .is('deleted_at', null)
      .not('hiring_completed_at', 'is', null)
      .not('applicant_completed_at', 'is', null)
      .or(`applicant_id.eq.${profileId},job.author_id.eq.${profileId}`),
  ]);

  const { count: unreadMsg } = await sb
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', profileId)
    .is('read_at', null)
    .filter('conversation_id', 'in', `(SELECT id FROM marie_wedding.conversations WHERE participant_a = '${profileId}' OR participant_b = '${profileId}')`);

  const reviewedSet = new Set(((myReviewsRes.data ?? []) as Array<{ application_id: string }>).map((r) => r.application_id));
  const deals = (dealsRes.data ?? []) as Array<{ id: string }>;
  const pendingReviews = deals.filter((d) => !reviewedSet.has(d.id)).length;

  return {
    unreadNotifications: unreadNotif.count ?? 0,
    pendingReceived: recvAll.count ?? 0,
    pendingReviews,
    unreadMessages: unreadMsg ?? 0,
    myJobs: myJobs.count ?? 0,
  };
}

export default async function HomeMyPanel({ profileId }: Props) {
  const [profile, m] = await Promise.all([loadProfile(profileId), loadMetrics(profileId)]);
  if (!profile) return null;
  const displayName = profile.company_name || profile.contact_name;
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Left: profile summary */}
        <div className="p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-100 flex items-center gap-4 lg:flex-col lg:items-start lg:justify-between">
          <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-secondary-100 flex items-center justify-center shrink-0">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary">{displayName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <Link href={ROUTES.MYPAGE} className="block text-[15px] font-bold text-gray-900 hover:text-primary truncate">
                {displayName}
              </Link>
              <p className="text-[12px] text-gray-500 mt-0.5">
                {profile.account_type === 'business' ? '업체 회원' : '개인 회원'}
              </p>
            </div>
          </div>
          <Link href={ROUTES.MYPAGE} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-700 hover:border-gray-400 transition-colors whitespace-nowrap lg:w-full lg:text-center">
            마이페이지
          </Link>
        </div>

        {/* Right: metrics + actions */}
        <div className="flex flex-col">
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            <MetricCell href={ROUTES.MYPAGE_NOTIFICATIONS} label="미확인 알림" value={m.unreadNotifications} highlight={m.unreadNotifications > 0} />
            <MetricCell href={ROUTES.MYPAGE_MESSAGES} label="새 메시지" value={m.unreadMessages} highlight={m.unreadMessages > 0} />
            <MetricCell href={ROUTES.MYPAGE} label="검토 대기" value={m.pendingReceived} />
            <MetricCell href={ROUTES.MYPAGE} label="리뷰 대기" value={m.pendingReviews} highlight={m.pendingReviews > 0} />
          </div>
          <div className="grid grid-cols-1 gap-2 p-4 border-t border-gray-100">
            <Link href={ROUTES.JOBS_NEW} className="btn-primary text-[14px]">+ 공고 등록</Link>
          </div>
        </div>
      </div>

      {/* Bottom: sub link row */}
      <div className="grid grid-cols-3 border-t border-gray-100 divide-x divide-gray-100">
        <SubLink href={ROUTES.MYPAGE} label="내 공고" value={m.myJobs} />
        <SubLink href={ROUTES.MYPAGE_BOOKMARKS} label="스크랩" />
        <SubLink href={ROUTES.MYPAGE_MESSAGES} label="쪽지" />
      </div>
    </div>
  );
}

function MetricCell({ href, label, value, highlight }: { href: string; label: string; value: number; highlight?: boolean }) {
  return (
    <Link href={href} className={`p-4 transition-colors hover:bg-gray-50 ${highlight ? 'bg-primary-50/40' : ''}`}>
      <p className="text-[12px] font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-[20px] font-bold tabular-nums ${highlight ? 'text-primary' : 'text-gray-900'}`}>
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function SubLink({ href, label, value }: { href: string; label: string; value?: number }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
      <span className="font-semibold">{label}</span>
      {typeof value === 'number'
        ? <span className="font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</span>
        : <span className="text-gray-400">→</span>}
    </Link>
  );
}
