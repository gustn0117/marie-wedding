import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 50;

/**
 * 대행 등록 공고 — 업체 '동의를 받아' 관리자가 대신 올리는 공고.
 *
 * 동의 기록(누구에게·언제·어떤 방법으로 받았는지)을 필수로 받는다. 동의 없이 남의 공고를
 * 옮겨 오는 것은 데이터베이스제작자 권리 침해이고(잡코리아 v 사람인, 서울고법),
 * 업체 명의로 허위 구인광고를 내는 문제도 생긴다. 그래서 기록을 강제한다.
 *
 * 주인이 없는 상태이므로 author_id 는 null 이고, 업체가 가입 후 claim_code 를 입력하면
 * 그 계정으로 넘어간다(/api/jobs/claim).
 */

/**
 * 마감일 정규화 — 날짜만 온 값을 KST 그날 끝으로 맞춘다.
 * (사용자 등록 경로 /api/jobs/write 와 같은 규칙. 안 맞추면 마감일 당일 오전에 조기 마감된다)
 */
const normalizeDeadline = (d?: string | null): string | null =>
  !d ? null : (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59+09:00` : d);

const MAX_SALARY = 100_000_000;
const JOB_IMAGES_MAX = 8;

/** 갤러리 경로 검증 — 버킷 밖을 가리키거나 상위로 빠져나가는 값을 거른다. */
function normalizeImages(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length <= 300 && !p.includes('..') && !p.startsWith('/') && !/^https?:/i.test(p));
  return cleaned.length > 0 ? cleaned.slice(0, JOB_IMAGES_MAX) : null;
}

/** 업체에 전달할 짧은 코드. 헷갈리는 글자(0/O/1/I)는 뺀다. */
function makeClaimCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const from = (page - 1) * PAGE;
  const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 100);

  const supabase = createServiceClient();
  let query = supabase
    .from('jobs')
    .select('id, title, region, business_type, employment_type, proxy_company_name, proxy_contact, proxy_consent_note, proxy_consent_at, claim_code, claimed_at, author_id, created_at, deleted_at', { count: 'exact' })
    .not('proxy_company_name', 'is', null);
  // 기본은 살아있는 것만. showDeleted=1 이면 삭제된 것까지 보여 복구할 수 있게 한다.
  if (url.searchParams.get('showDeleted') !== '1') query = query.is('deleted_at', null);
  if (q) query = query.or(`proxy_company_name.ilike.%${q}%,title.ilike.%${q}%`);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);

  let rows = data ?? [];
  let total = count ?? 0;
  if (error) {
    if (error.code !== 'PGRST103') {
      console.error('[api/admin/proxy-jobs] list failed:', error);
      return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 });
    }
    rows = [];
    total = 0;
  }

  return NextResponse.json({ items: rows, count: total, page, pageSize: PAGE });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const supabase = createServiceClient();

  // 삭제 — soft delete(다른 공고 삭제와 같은 방식). 이미 이관된 공고도 지울 수 있게 두되,
  // 그 경우 업체 화면에서도 사라지므로 화면에서 한 번 더 확인을 받는다.
  if (body.action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[api/admin/proxy-jobs] delete failed:', error);
      return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 되살리기
  if (body.action === 'restore') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { error } = await supabase.from('jobs').update({ deleted_at: null }).eq('id', id);
    if (error) return NextResponse.json({ error: '복구에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 관리자가 직접 넘기기 — 업체가 코드를 잃어버렸을 때의 우회로.
  if (body.action === 'assign') {
    const id = typeof body.id === 'string' ? body.id : '';
    const profileId = typeof body.profileId === 'string' ? body.profileId : '';
    if (!id || !profileId) return NextResponse.json({ error: 'id 와 profileId 가 필요합니다.' }, { status: 400 });

    const { data: profile } = await supabase
      .from('profiles').select('id, account_type').eq('id', profileId).is('deleted_at', null).maybeSingle();
    if (!profile) return NextResponse.json({ error: '해당 프로필을 찾을 수 없습니다.' }, { status: 404 });
    if (profile.account_type !== 'business') {
      return NextResponse.json({ error: '업체 회원에게만 넘길 수 있습니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('jobs')
      .update({ author_id: profileId, claimed_at: new Date().toISOString(), claim_code: null })
      .eq('id', id)
      .is('author_id', null);
    if (error) return NextResponse.json({ error: '이관에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 코드 재발급
  if (body.action === 'regenerate-code') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const code = makeClaimCode();
    const { error } = await supabase
      .from('jobs').update({ claim_code: code }).eq('id', id).is('author_id', null);
    if (error) return NextResponse.json({ error: '코드 재발급에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true, claimCode: code });
  }

  if (body.action === 'create') {
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    const consentNote = typeof body.consentNote === 'string' ? body.consentNote.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const businessType = typeof body.businessType === 'string' ? body.businessType : '';
    const employmentType = typeof body.employmentType === 'string' ? body.employmentType : '';
    const region = typeof body.region === 'string' ? body.region : '';
    const salaryInfo = typeof body.salaryInfo === 'string' ? body.salaryInfo.trim() : '';
    const num = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);
    const salaryMin = num(body.salaryMin);
    const salaryMax = num(body.salaryMax);
    const salaryUnit = ['monthly', 'yearly', 'daily', 'hourly'].includes(String(body.salaryUnit))
      ? String(body.salaryUnit) : 'monthly';
    const experienceMin = num(body.experienceMin);
    const deadline = typeof body.deadline === 'string' ? body.deadline : '';
    const image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null;
    const images = normalizeImages(body.images);

    if (!companyName) return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
    if (!contact) return NextResponse.json({ error: '업체 연락처를 입력해주세요.' }, { status: 400 });
    // 동의 기록은 이 기능의 법적 근거다 — 비워둘 수 없다.
    if (consentNote.length < 5) {
      return NextResponse.json(
        { error: '동의를 받은 경위를 적어주세요. (예: 2026-07-26 전화 통화, 예약실 김○○ 실장 동의)' },
        { status: 400 },
      );
    }
    if (!title || !description || !businessType || !employmentType || !region) {
      return NextResponse.json({ error: '공고 제목·내용·업종·고용형태·지역은 필수입니다.' }, { status: 400 });
    }
    // 급여·경력 범위 — 사용자 등록 경로와 동일하게 서버에서 다시 막는다(INTEGER 초과·역전 방지).
    for (const [label, v] of [['최소', salaryMin], ['최대', salaryMax]] as const) {
      if (v !== null && (v < 0 || v > MAX_SALARY)) {
        return NextResponse.json({ error: `급여 ${label}값이 올바르지 않습니다.` }, { status: 400 });
      }
    }
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      return NextResponse.json({ error: '급여 최소값이 최대값보다 클 수 없습니다.' }, { status: 400 });
    }
    if (experienceMin !== null && (experienceMin < 0 || experienceMin > 50)) {
      return NextResponse.json({ error: '최소 경력 값이 올바르지 않습니다.' }, { status: 400 });
    }

    const claimCode = makeClaimCode();
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        id: randomUUID(),
        author_id: null, // 아직 주인이 없다
        posting_type: 'hiring',
        title: title.slice(0, 200),
        description,
        business_type: businessType,
        employment_type: employmentType,
        region,
        salary_info: salaryInfo || null,
        salary_min: salaryMin,
        salary_max: salaryMax,
        salary_unit: salaryUnit,
        experience_min: experienceMin,
        deadline: normalizeDeadline(deadline),
        image,
        images,
        proxy_company_name: companyName.slice(0, 200),
        proxy_contact: contact.slice(0, 200),
        proxy_consent_note: consentNote.slice(0, 1000),
        proxy_consent_at: new Date().toISOString(),
        claim_code: claimCode,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[api/admin/proxy-jobs] create failed:', error);
      return NextResponse.json({ error: `등록에 실패했습니다: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id, claimCode });
  }

  return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
}
