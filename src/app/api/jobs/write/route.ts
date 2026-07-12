import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { checkBusinessProfileCompleteness } from '@/features/jobs/lib/business-profile-completeness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 채용 공고 create/update API (service_role).
 * QA-010 재발 방지 — auto_moderate_job + protect_job_admin_cols 트리거 조합 우회.
 *
 * Body:
 *  { mode: 'create', payload: JobFormData }
 *  { mode: 'update', id: string, payload: Partial<JobFormData> }
 */
interface JobPayload {
  title?: string;
  description?: string;
  businessType?: string;
  employmentType?: string;
  region?: string;
  salaryInfo?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryUnit?: 'monthly' | 'yearly' | 'daily' | 'hourly';
  experienceMin?: number | null;
  deadline?: string | null;
  image?: string | null;
}

export async function POST(request: Request) {
  let body: { mode?: 'create' | 'update'; id?: string; payload?: JobPayload };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const mode = body.mode;
  const payload = body.payload ?? {};
  if (mode !== 'create' && mode !== 'update') {
    return NextResponse.json({ error: 'mode 는 create 또는 update' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const ssr = createServerClient(
    SUPABASE_SERVER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from('profiles')
    .select('id, role, account_type, company_name, business_type, region, phone, bio')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 });
  if (me.account_type !== 'business' && me.role !== 'admin') {
    return NextResponse.json({ error: '공고 등록은 업체 회원만 가능합니다.' }, { status: 403 });
  }

  if (mode === 'create') {
    const check = checkBusinessProfileCompleteness(me);
    if (!check.isComplete) {
      const missing = check.missing.map((m) => m.label).join(', ');
      return NextResponse.json({ error: `업체 프로필을 먼저 완성해주세요. 부족한 항목: ${missing}` }, { status: 400 });
    }
    if (!payload.title || !payload.description || !payload.businessType || !payload.employmentType || !payload.region) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
    }
    const { error: insertErr } = await service.from('jobs').insert({
      author_id: me.id,
      posting_type: 'hiring',
      title: payload.title,
      description: payload.description,
      business_type: payload.businessType,
      employment_type: payload.employmentType,
      region: payload.region,
      salary_info: payload.salaryInfo || null,
      salary_min: payload.salaryMin ?? null,
      salary_max: payload.salaryMax ?? null,
      salary_unit: payload.salaryUnit ?? 'monthly',
      experience_min: payload.experienceMin ?? null,
      deadline: payload.deadline || null,
      image: payload.image || null,
    });
    if (insertErr) {
      console.error('[jobs/write:create] failed:', insertErr);
      return NextResponse.json({ error: `등록에 실패했습니다: ${insertErr.message}` }, { status: 500 });
    }
    // insert 후 별도 select — trigger RETURNING null 회피
    const { data: latest } = await service
      .from('jobs')
      .select('*')
      .eq('author_id', me.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ success: true, job: latest });
  }

  // update
  const id = body.id?.trim();
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
  const { data: existing } = await service.from('jobs').select('id, author_id, deleted_at').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
  if (existing.deleted_at) return NextResponse.json({ error: '이미 삭제된 공고입니다.' }, { status: 410 });
  const canManage = me.id === existing.author_id || me.role === 'admin';
  if (!canManage) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.businessType !== undefined) updateData.business_type = payload.businessType;
  if (payload.employmentType !== undefined) updateData.employment_type = payload.employmentType;
  if (payload.region !== undefined) updateData.region = payload.region;
  if (payload.salaryInfo !== undefined) updateData.salary_info = payload.salaryInfo || null;
  if (payload.salaryMin !== undefined) updateData.salary_min = payload.salaryMin;
  if (payload.salaryMax !== undefined) updateData.salary_max = payload.salaryMax;
  if (payload.salaryUnit !== undefined) updateData.salary_unit = payload.salaryUnit;
  if (payload.experienceMin !== undefined) updateData.experience_min = payload.experienceMin;
  if (payload.deadline !== undefined) updateData.deadline = payload.deadline || null;
  if (payload.image !== undefined) updateData.image = payload.image || null;

  const { error: updErr } = await service.from('jobs').update(updateData).eq('id', id);
  if (updErr) {
    console.error('[jobs/write:update] failed:', updErr);
    return NextResponse.json({ error: `수정에 실패했습니다: ${updErr.message}` }, { status: 500 });
  }
  const { data: refreshed } = await service.from('jobs').select('*').eq('id', id).maybeSingle();
  return NextResponse.json({ success: true, job: refreshed });
}
