import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { normalizeSearchTerm } from '@/shared/utils/searchQuery';
import { isUuid } from '@/shared/utils/uuid';
import { sameNullableTimestamp } from '@/shared/utils/idempotency';

const ADMIN_REQUEST_TIMEOUT_MS = 12_000;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const requestSignal = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(ADMIN_REQUEST_TIMEOUT_MS),
  ]);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { action, ...rawParams } = body;
  // 과거 호환용 body.password는 의도적으로 무시한다. 비밀번호 검증은 unlock 한 곳뿐이다.
  const params = { ...rawParams };
  delete params.password;

  if (!(await isAdminRequest(requestSignal))) {
    return requestSignal.aborted
      ? NextResponse.json({ error: '관리자 인증 시간이 초과되었습니다.' }, { status: 504 })
      : unauthorized();
  }

  // 이 클라이언트의 REST/Auth fetch 전체가 같은 요청 deadline을 공유한다.
  const supabase = createServiceClient(requestSignal);

  try {
    switch (action) {
      case 'ping':
        return NextResponse.json({ success: true });

      // ── Stats ──
      case 'getStats': {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [users, jobs, posts, comments, reports, recentUsers, recentJobs] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('comments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
        ]);

        return NextResponse.json({
          users: users.count ?? 0,
          jobs: jobs.count ?? 0,
          posts: posts.count ?? 0,
          comments: comments.count ?? 0,
          reports: reports.count ?? 0,
          recentUsers: recentUsers.count ?? 0,
          recentJobs: recentJobs.count ?? 0,
        });
      }

      // ── Dashboard 종합 (stats + funnel + recent users + recent jobs) ──
      case 'getDashboard': {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
          users, jobs, posts, comments, reports, recentUsersCount, recentJobsCount,
          appAll, appAccepted, deals, reviews,
          recentUsers, recentJobs,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('posts').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('comments').select('*', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', weekAgo),
          supabase.from('applications').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('applications').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'accepted'),
          supabase.from('applications').select('id', { count: 'exact', head: true })
            .is('deleted_at', null).not('hiring_completed_at', 'is', null).not('applicant_completed_at', 'is', null),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('profiles').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
          supabase.from('jobs').select('*, author:profiles!jobs_author_id_fkey(id,company_name,contact_name,business_type,region)').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
        ]);

        return NextResponse.json({
          stats: {
            users: users.count ?? 0,
            jobs: jobs.count ?? 0,
            posts: posts.count ?? 0,
            comments: comments.count ?? 0,
            reports: reports.count ?? 0,
            recentUsers: recentUsersCount.count ?? 0,
            recentJobs: recentJobsCount.count ?? 0,
          },
          funnel: {
            totalApplications: appAll.count ?? 0,
            acceptedApplications: appAccepted.count ?? 0,
            completedApplications: deals.count ?? 0,
            reviewsWritten: reviews.count ?? 0,
          },
          recentUsers: recentUsers.data ?? [],
          recentJobs: recentJobs.data ?? [],
        });
      }

      // ── Users ──
      case 'getUsers': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) {
          const term = normalizeSearchTerm(search);
          if (term) query = query.or(`contact_name.ilike.%${term}%,company_name.ilike.%${term}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getUserDetail': {
        const { id } = params as { id: string };
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (profileErr) throw profileErr;
        if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 });

        let authUser: {
          id: string;
          email: string | null;
          phone: string | null;
          created_at: string | null;
          last_sign_in_at: string | null;
          email_confirmed_at: string | null;
          identities: Array<{ provider: string; last_sign_in_at: string | null; identity_data: Record<string, unknown> | null }>;
          banned_until: string | null;
        } | null = null;
        try {
          const { data: au } = await supabase.auth.admin.getUserById(profile.user_id);
          if (au?.user) {
            authUser = {
              id: au.user.id,
              email: au.user.email ?? null,
              phone: au.user.phone ?? null,
              created_at: au.user.created_at ?? null,
              last_sign_in_at: au.user.last_sign_in_at ?? null,
              email_confirmed_at: au.user.email_confirmed_at ?? null,
              identities: (au.user.identities ?? []).map((i) => ({
                provider: i.provider,
                last_sign_in_at: i.last_sign_in_at ?? null,
                identity_data: (i.identity_data ?? null) as Record<string, unknown> | null,
              })),
              banned_until: (au.user as unknown as { banned_until?: string | null }).banned_until ?? null,
            };
          }
        } catch (e) {
          console.error('getUserById failed', e);
        }

        // 활동 카운트 — 공고 / 게시글 / 댓글 / 받은 지원 / 보낸 지원
        const [jobsCount, postsCount, commentsCount, applicationsSent, applicationsReceived] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('author_id', id).is('deleted_at', null),
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', id).is('deleted_at', null),
          supabase.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', id).is('deleted_at', null),
          supabase.from('applications').select('*', { count: 'exact', head: true }).eq('applicant_id', id).is('deleted_at', null),
          supabase.from('applications').select('jobs!inner(author_id)', { count: 'exact', head: true }).eq('jobs.author_id', id).is('deleted_at', null),
        ]);

        return NextResponse.json({
          profile,
          auth: authUser,
          activity: {
            jobs: jobsCount.count ?? 0,
            posts: postsCount.count ?? 0,
            comments: commentsCount.count ?? 0,
            applications_sent: applicationsSent.count ?? 0,
            applications_received: applicationsReceived.count ?? 0,
          },
        });
      }

      case 'getRecentUsers': {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(params.limit ?? 5);
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }

      case 'updateUserRole': {
        const { error } = await supabase.from('profiles').update({ role: params.role }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'softDeleteUser': {
        // 관리자 삭제 = "다시 로그인 못 하게" 제거. GoTrue ban 을 먼저 걸어(부분 실패해도 잠금이
        // 남도록) auth 계정 자체의 재로그인을 차단한 뒤 콘텐츠를 purge 한다. 자가탈퇴(withdraw)는
        // ban 을 안 걸어 재로그인 시 /auth/reactivate 로 부활 가능 — 둘을 GoTrue ban 유무로 구분한다.
        const { data: prof, error: profErr } = await supabase.from('profiles').select('user_id').eq('id', params.id).maybeSingle();
        if (profErr) throw profErr; // 조회 오류를 무시하면 아래 ban 을 건너뛰어 잠금이 새므로 반드시 중단.
        if (!prof?.user_id) return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 });
        // 순서: banned_at(앱필드) → GoTrue ban → purge. banned_at 을 '먼저' 남기면 이후 어떤 단계가
        // 실패해(deleted_at 미설정) 재로그인이 되더라도 미들웨어가 banned_at 으로 /banned 에 잡아
        // 기존 세션·신규 세션 모두 활성으로 새지 않는다. GoTrue ban 은 재로그인·토큰갱신 자체를 차단.
        const { error: markErr } = await supabase
          .from('profiles')
          .update({ banned_at: new Date().toISOString(), banned_reason: '관리자 삭제' })
          .eq('id', params.id);
        if (markErr) throw markErr;
        const { error: banErr } = await supabase.auth.admin.updateUserById(prof.user_id, { ban_duration: '876600h' });
        if (banErr) throw banErr;
        const { error } = await supabase.rpc('purge_profile_cascade', { p_profile_id: params.id });
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreUser': {
        const { data: prof } = await supabase.from('profiles').select('user_id').eq('id', params.id).maybeSingle();
        // GoTrue unban 을 먼저(실패 시 DB 미변경 → 반쪽상태 방지). 성공해야 프로필 잠금 해제.
        if (prof?.user_id) {
          const { error: unbanErr } = await supabase.auth.admin.updateUserById(prof.user_id, { ban_duration: 'none' });
          if (unbanErr) throw unbanErr;
        }
        const { error } = await supabase
          .from('profiles')
          .update({ deleted_at: null, banned_at: null, banned_reason: null, banned_by: null })
          .eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Jobs ──
      case 'getJobs': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) {
          const term = normalizeSearchTerm(search);
          if (term) query = query.ilike('title', `%${term}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getRecentJobs': {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(params.limit ?? 5);
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }

      case 'softDeleteJob': {
        const { error } = await supabase.from('jobs').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreJob': {
        const { error } = await supabase.from('jobs').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── 인기 공고 (Featured) ──
      case 'getFeaturedJobs': {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, author:profiles!author_id(*)')
          .is('deleted_at', null)
          .not('featured_at', 'is', null)
          .order('featured_order', { ascending: true })
          .order('featured_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        return NextResponse.json(data ?? []);
      }

      case 'toggleFeaturedJob': {
        const { id, featured } = params as { id: string; featured: boolean };
        if (featured) {
          const { data: max } = await supabase
            .from('jobs')
            .select('featured_order')
            .not('featured_order', 'is', null)
            .order('featured_order', { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (max?.featured_order ?? 0) + 10;
          const { error } = await supabase
            .from('jobs')
            .update({ featured_at: new Date().toISOString(), featured_order: nextOrder })
            .eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('jobs')
            .update({ featured_at: null, featured_order: null })
            .eq('id', id);
          if (error) throw error;
        }
        revalidateTag('home-data'); // 메인 인기공고 즉시 반영
        return NextResponse.json({ success: true });
      }

      case 'toggleFeaturedProfile': {
        const { id, featured } = params as { id: string; featured: boolean };
        if (featured) {
          // 디렉토리 노출 조건(deleted_at IS NULL AND is_directory_listed=true)을 못 채운 프로필을
          // 추천하면 메인에 뜨지 않아 "추천했는데 안 보인다"가 된다. 미리 막고 명확히 안내한다.
          const { data: target } = await supabase
            .from('profiles')
            .select('is_directory_listed, deleted_at')
            .eq('id', id)
            .maybeSingle();
          if (!target || target.deleted_at || !target.is_directory_listed) {
            return NextResponse.json(
              { error: '비공개(디렉토리 미노출)이거나 탈퇴한 프로필은 추천할 수 없습니다.' },
              { status: 400 },
            );
          }
          const { data: max } = await supabase
            .from('profiles')
            .select('featured_order')
            .not('featured_order', 'is', null)
            .order('featured_order', { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (max?.featured_order ?? 0) + 10;
          const { error } = await supabase
            .from('profiles')
            .update({ featured_at: new Date().toISOString(), featured_order: nextOrder })
            .eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('profiles')
            .update({ featured_at: null, featured_order: null })
            .eq('id', id);
          if (error) throw error;
        }
        revalidateTag('home-data'); // 메인 추천 프로필 즉시 반영
        return NextResponse.json({ success: true });
      }

      case 'reorderFeaturedJobs': {
        const { orderedIds } = params as { orderedIds: string[] };
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
          return NextResponse.json({ success: true });
        }
        if (orderedIds.some((id) => !isUuid(id)) || new Set(orderedIds).size !== orderedIds.length) {
          return NextResponse.json({ error: '공고 순서 목록이 올바르지 않습니다.' }, { status: 400 });
        }
        const results = await Promise.all(
          orderedIds.map((id, idx) =>
            supabase
              .from('jobs')
              .update({ featured_order: (idx + 1) * 10 })
              .eq('id', id),
          ),
        );
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
        revalidateTag('home-data');
        return NextResponse.json({ success: true });
      }

      // ── Posts ──
      case 'getPosts': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('posts')
          .select('*, author:profiles!author_id(*), comments:comments!comments_post_id_fkey(count)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        // 댓글 수는 소프트삭제 제외 — 공개 목록/카운트 기준과 일치시킨다.
        query = query.filter('comments.deleted_at', 'is', null);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) {
          const term = normalizeSearchTerm(search);
          if (term) query = query.ilike('title', `%${term}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const posts = (data ?? []).map((row: any) => ({
          ...row,
          comment_count: row.comments?.[0]?.count ?? 0,
        }));

        return NextResponse.json({ data: posts, count: count ?? 0 });
      }

      case 'softDeletePost': {
        const { error } = await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restorePost': {
        const { error } = await supabase.from('posts').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Comments ──
      case 'getComments': {
        const { page = 1, search, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('comments')
          .select('*, author:profiles!author_id(*), post:posts!post_id(id, title)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (search) {
          const term = normalizeSearchTerm(search);
          if (term) query = query.ilike('content', `%${term}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'softDeleteComment': {
        const { error } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreComment': {
        const { error } = await supabase.from('comments').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      // ── Reports ──
      case 'getReports': {
        const { page = 1, status } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('reports')
          .select('*, reporter:profiles!reporter_id(*)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (status) query = query.eq('status', status);

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'updateReportStatus': {
        const { data, error } = await supabase
          .from('reports')
          .update({ status: params.status })
          .eq('id', params.id)
          .select('*, reporter:profiles!reporter_id(*)')
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      // ── Events ──
      case 'getEvents': {
        const { page = 1, search, type, showDeleted = false } = params;
        const pageSize = 20;
        const from = (page - 1) * pageSize;

        let query = supabase
          .from('events')
          .select('*', { count: 'exact' })
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (!showDeleted) query = query.is('deleted_at', null);
        if (type) query = query.eq('type', type);
        if (search) {
          const term = normalizeSearchTerm(search);
          if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return NextResponse.json({ data: data ?? [], count: count ?? 0 });
      }

      case 'getEvent': {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', params.id)
          .single();
        if (error) throw error;
        return NextResponse.json(data);
      }

      case 'createEvent': {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
        const eventId = typeof params.id === 'string' ? params.id.trim() : '';
        if (!isUuid(eventId)) {
          return NextResponse.json({ error: '유효한 생성 ID가 필요합니다.' }, { status: 400 });
        }
        const createInput = {
          id: eventId,
          title: params.title,
          content: params.content,
          type: params.type || 'event',
          image: params.image || null,
          start_date: params.start_date || null,
          end_date: params.end_date || null,
          location: params.location || null,
          link_url: params.link_url || null,
          is_pinned: !!params.is_pinned,
        };
        const { error } = await supabase
          .from('events')
          .insert(createInput)
          .abortSignal(signal);
        if (error) {
          if (error.code === '23505') {
            const { data: existing, error: replayError } = await supabase
              .from('events')
              .select('id, title, content, type, image, start_date, end_date, location, link_url, is_pinned, deleted_at')
              .eq('id', eventId)
              .abortSignal(signal)
              .maybeSingle();
            if (replayError) throw replayError;
            const sameContext = !!existing && !existing.deleted_at;
            const exactReplay = sameContext
              && existing.title === createInput.title
              && existing.content === createInput.content
              && existing.type === createInput.type
              && existing.image === createInput.image
              && sameNullableTimestamp(existing.start_date, createInput.start_date)
              && sameNullableTimestamp(existing.end_date, createInput.end_date)
              && existing.location === createInput.location
              && existing.link_url === createInput.link_url
              && existing.is_pinned === createInput.is_pinned;
            if (exactReplay) {
              return NextResponse.json({ id: eventId, replayed: true });
            }
            if (sameContext) {
              return NextResponse.json({
                error: '같은 생성 ID로 이미 다른 내용의 행사가 등록되었습니다. 기존에 생성된 행사를 확인한 뒤 해당 항목을 수정해주세요.',
              }, { status: 409 });
            }
            return NextResponse.json({ error: '이미 사용된 생성 ID입니다.' }, { status: 409 });
          }
          throw error;
        }
        return NextResponse.json({ id: eventId });
      }

      case 'updateEvent': {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (params.title !== undefined) payload.title = params.title;
        if (params.content !== undefined) payload.content = params.content;
        if (params.type !== undefined) payload.type = params.type;
        if (params.image !== undefined) payload.image = params.image || null;
        if (params.start_date !== undefined) payload.start_date = params.start_date || null;
        if (params.end_date !== undefined) payload.end_date = params.end_date || null;
        if (params.location !== undefined) payload.location = params.location || null;
        if (params.link_url !== undefined) payload.link_url = params.link_url || null;
        if (params.is_pinned !== undefined) payload.is_pinned = !!params.is_pinned;

        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', params.id)
          .abortSignal(signal);
        if (error) throw error;
        return NextResponse.json({ id: params.id });
      }

      case 'softDeleteEvent': {
        const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'restoreEvent': {
        const { error } = await supabase.from('events').update({ deleted_at: null }).eq('id', params.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    if (requestSignal.aborted) {
      return NextResponse.json(
        { error: '관리자 요청 시간이 초과되었습니다. 현재 상태를 다시 확인해 주세요.' },
        { status: 504 },
      );
    }
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
