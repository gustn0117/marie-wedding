import Link from 'next/link';
import { createServerQueryClient } from '@/lib/supabase/server-query';
import { ROUTES } from '@/shared/constants';
import { TRUST_TIER_LABELS, computeTrustTier, type Profile } from '@/types/database';

interface Props {
  profileId: string;
}

interface Metrics {
  unreadNotifications: number;
  pendingReceived: number;
  acceptedReceived: number;
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
  const [unreadNotif, recvAll, recvAccepted, myJobs, myReviewsRes, dealsRes] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId).is('read_at', null).is('deleted_at', null),
    sb.from('applications').select('id, status', { count: 'exact' })
      .is('deleted_at', null)
      .in('status', ['pending', 'reviewing'])
      .filter('job_id', 'in', `(SELECT id FROM marie_wedding.jobs WHERE author_id = '${profileId}' AND deleted_at IS NULL)`),
    sb.from('applications').select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'accepted'),
    sb.from('jobs').select('id', { count: 'exact', head: true })
      .eq('author_id', profileId).is('deleted_at', null),
    sb.from('reviews').select('application_id').eq('reviewer_id', profileId).is('deleted_at', null),
    sb.from('applications').select('id, applicant_id, job_id, hiring_completed_at, applicant_completed_at, job:jobs!inner(author_id)')
      .is('deleted_at', null)
      .not('hiring_completed_at', 'is', null)
      .not('applicant_completed_at', 'is', null)
      .or(`applicant_id.eq.${profileId},job.author_id.eq.${profileId}`),
  ]);

  // unread messages (sender != me, read_at null, conversation includes me)
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
    acceptedReceived: recvAccepted.count ?? 0,
    pendingReviews,
    unreadMessages: unreadMsg ?? 0,
    myJobs: myJobs.count ?? 0,
  };
}

export default async function HomeMyPanel({ profileId }: Props) {
  const [profile, m] = await Promise.all([loadProfile(profileId), loadMetrics(profileId)]);
  if (!profile) return null;
  const trustTier = computeTrustTier(profile);
  const displayName = profile.company_name || profile.contact_name;
  const imageUrl = profile.profile_image
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.profile_image}`
    : null;

  return (
    <aside className="rounded border border-gray-900 bg-gray-950 p-4 text-white">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary-300">My Workspace</p>
          <Link href={ROUTES.MYPAGE} className="block mt-1 text-base font-bold truncate hover:text-primary-200">
            {displayName} <span className="text-xs text-gray-300">님</span>
          </Link>
        </div>
        <Link href={ROUTES.MYPAGE} className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold text-gray-200 hover:border-white/40 hover:text-white shrink-0">
          마이페이지
        </Link>
      </div>

      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="w-12 h-12 rounded overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold text-primary-200">{displayName.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-300">{profile.account_type === 'business' ? '업체 회원' : '개인 회원'}</p>
          <p className="mt-0.5 text-sm font-bold text-white">{TRUST_TIER_LABELS[trustTier]}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <DarkMetric label="미확인 알림" value={m.unreadNotifications} highlight={m.unreadNotifications > 0} href={ROUTES.MYPAGE_NOTIFICATIONS} />
        <DarkMetric label="새 메시지" value={m.unreadMessages} highlight={m.unreadMessages > 0} href={ROUTES.MYPAGE_MESSAGES} />
        <DarkMetric label="검토 대기" value={m.pendingReceived} href={ROUTES.MYPAGE} />
        <DarkMetric label="리뷰 작성 대기" value={m.pendingReviews} highlight={m.pendingReviews > 0} href={ROUTES.MYPAGE} />
      </div>

      <div className="grid gap-2 mb-4">
        <Link href={ROUTES.JOBS_NEW} className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded bg-white px-4 py-2 text-sm font-bold text-gray-950 hover:bg-primary-50">
          + 공고 등록
        </Link>
        <Link href={ROUTES.MYPAGE_VERIFICATION} className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-white/40">
          {profile.verification_status === 'verified' ? '인증 정보 보기' : '업체 인증하기'}
        </Link>
      </div>

      <div className="divide-y divide-white/10 rounded border border-white/10">
        <BoardLink href={ROUTES.MYPAGE} title="내가 등록한 공고" value={m.myJobs} />
        <BoardLink href={ROUTES.MYPAGE_PORTFOLIOS} title="포트폴리오 관리" value={0} hideValue />
        <BoardLink href={ROUTES.MYPAGE_SAVED_SEARCHES} title="저장한 검색" value={0} hideValue />
      </div>
    </aside>
  );
}

function DarkMetric({ label, value, highlight, href }: { label: string; value: number; highlight?: boolean; href?: string }) {
  const inner = (
    <div className={`rounded border px-3 py-2.5 transition-colors ${highlight ? 'border-primary-300 bg-primary-300/10' : 'border-white/15 bg-white/[0.03] hover:border-white/30'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-300">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? 'text-primary-200' : 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function BoardLink({ href, title, value, hideValue }: { href: string; title: string; value: number; hideValue?: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
      <span className="font-semibold">{title}</span>
      {!hideValue && <span className="font-bold text-white tabular-nums">{value.toLocaleString()}</span>}
      {hideValue && <span className="text-xs text-gray-400">→</span>}
    </Link>
  );
}
