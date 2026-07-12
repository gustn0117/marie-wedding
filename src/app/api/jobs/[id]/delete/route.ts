import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 채용 공고 soft delete API.
 *
 * 클라이언트 측 UPDATE가 RLS WITH CHECK에서 막히는 케이스를 우회.
 * 직접 권한 검증(본인 또는 admin) 후 service_role로 update.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const service = createServiceClient();

  // 본인 profile + 해당 공고의 author 확인
  const [{ data: profile }, { data: job }] = await Promise.all([
    service.from('profiles').select('id, role').eq('user_id', user.id).maybeSingle(),
    service.from('jobs').select('id, author_id, deleted_at').eq('id', id).maybeSingle(),
  ]);

  if (!profile) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  }
  if (!job) {
    return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (job.deleted_at) {
    return NextResponse.json({ error: '이미 삭제된 공고입니다.' }, { status: 410 });
  }

  const canManage = profile.id === job.author_id || profile.role === 'admin';
  if (!canManage) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { error } = await service
    .from('jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: `공고 삭제에 실패했습니다: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
