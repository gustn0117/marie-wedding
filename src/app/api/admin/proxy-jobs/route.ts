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


/**
 * 공고 본문 필드 파싱·검증 — 등록과 수정이 같은 규칙을 쓰도록 한 곳에 모은다.
 * (사용자 등록 경로 /api/jobs/write 와 동일한 상한·역전 검사)
 */
function readJobFields(body: Record<string, unknown>):
  | { error: string }
  | { fields: Record<string, unknown> } {
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

  if (!title || !description || !businessType || !employmentType || !region) {
    return { error: '공고 제목·내용·업종·고용형태·지역은 필수입니다.' };
  }
  for (const [label, v] of [['최소', salaryMin], ['최대', salaryMax]] as const) {
    if (v !== null && (v < 0 || v > MAX_SALARY)) return { error: `급여 ${label}값이 올바르지 않습니다.` };
  }
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { error: '급여 최소값이 최대값보다 클 수 없습니다.' };
  }
  if (experienceMin !== null && (experienceMin < 0 || experienceMin > 50)) {
    return { error: '최소 경력 값이 올바르지 않습니다.' };
  }

  return {
    fields: {
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
    },
  };
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
  // 이관 대상 업체 후보 — 관리자가 목록에서 골라 넘길 때 쓴다.
  // 프로필 ID 를 손으로 입력하면 오타 한 글자로 엉뚱한 업체에 공고가 넘어간다.
  if (url.searchParams.get('candidates') === '1') {
    const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 60);
    const supabase = createServiceClient();
    let cq = supabase
      .from('profiles')
      .select('id, company_name, contact_name, region, business_type, created_at')
      .eq('account_type', 'business')
      .is('deleted_at', null)
      .is('banned_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (q) cq = cq.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`);
    const { data, error } = await cq;
    if (error) {
      console.error('[api/admin/proxy-jobs] candidates failed:', error);
      return NextResponse.json({ error: '업체 목록을 불러오지 못했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ items: data ?? [] });
  }

  // 단건 조회 — 수정 화면이 폼을 채울 때 쓴다.
  const one = url.searchParams.get('id');
  if (one) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', one)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
    if (!data.proxy_company_name) {
      return NextResponse.json({ error: '대행 등록 공고가 아닙니다.' }, { status: 403 });
    }
    return NextResponse.json({ job: data });
  }

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

  // 수정 — 등록과 같은 필드를 받는다. 대행 정보(업체명·연락처·동의 경위)도 고칠 수 있다.
  // 소유권 관련 값(author_id / claim_code / claimed_at)은 건드리지 않는다. 수정으로 주인이
  // 바뀌거나 이미 발급된 코드가 무효화되면 업체가 가져가지 못한다.
  if (body.action === 'update') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const { data: existing } = await supabase
      .from('jobs')
      .select('id, proxy_company_name, deleted_at')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: '공고를 찾을 수 없습니다.' }, { status: 404 });
    if (existing.deleted_at) return NextResponse.json({ error: '삭제된 공고는 수정할 수 없습니다.' }, { status: 400 });
    // 대행 공고만 이 화면에서 다룬다(일반 공고는 업체 소유라 여기서 손대지 않는다).
    if (!existing.proxy_company_name) {
      return NextResponse.json({ error: '대행 등록 공고만 수정할 수 있습니다.' }, { status: 403 });
    }

    const parsed = readJobFields(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const patch: Record<string, unknown> = { ...parsed.fields, updated_at: new Date().toISOString() };
    // 대행 정보는 등록과 같은 규칙으로 검증한다. 빈 값을 조용히 무시하면 화면은 '수정했습니다'
    // 인데 예전 값이 남아 저장 실패를 성공으로 보고하게 되고, 동의 기록 최소 길이도 수정
    // 경로로만 우회된다(이 필드가 이 기능의 법적 근거다).
    if (body.companyName !== undefined) {
      const v = typeof body.companyName === 'string' ? body.companyName.trim() : '';
      if (!v) return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
      patch.proxy_company_name = v.slice(0, 200);
    }
    if (body.contact !== undefined) {
      const v = typeof body.contact === 'string' ? body.contact.trim() : '';
      if (!v) return NextResponse.json({ error: '업체 연락처를 입력해주세요.' }, { status: 400 });
      patch.proxy_contact = v.slice(0, 200);
    }
    if (body.consentNote !== undefined) {
      const v = typeof body.consentNote === 'string' ? body.consentNote.trim() : '';
      if (v.length < 5) {
        return NextResponse.json({ error: '동의를 받은 경위를 적어주세요. (5자 이상)' }, { status: 400 });
      }
      patch.proxy_consent_note = v.slice(0, 1000);
    }

    const { error } = await supabase.from('jobs').update(patch).eq('id', id);
    if (error) {
      console.error('[api/admin/proxy-jobs] update failed:', error);
      return NextResponse.json({ error: `수정에 실패했습니다: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id });
  }

  // 삭제 — soft delete(다른 공고 삭제와 같은 방식). 이미 이관된 공고도 지울 수 있게 두되,
  // 그 경우 업체 화면에서도 사라지므로 화면에서 한 번 더 확인을 받는다.
  if (body.action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    // 이 엔드포인트는 대행 공고 전용이다. 업체가 직접 올린 공고까지 지울 수 있으면
    // 화면 상태가 어긋났을 때 무관한 업체 공고가 조용히 내려간다.
    const { data: deleted, error } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .not('proxy_company_name', 'is', null)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[api/admin/proxy-jobs] delete failed:', error);
      return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
    }
    if (!deleted) return NextResponse.json({ error: '대행 등록 공고를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // 되살리기
  if (body.action === 'restore') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { data: restored, error } = await supabase
      .from('jobs')
      .update({ deleted_at: null })
      .eq('id', id)
      .not('proxy_company_name', 'is', null)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: '복구에 실패했습니다.' }, { status: 500 });
    if (!restored) return NextResponse.json({ error: '대행 등록 공고를 찾을 수 없습니다.' }, { status: 404 });
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

    // 갱신된 행을 반드시 확인한다. 조건부 UPDATE 는 0행이어도 error 가 나지 않아,
    // 그 사이 업체가 코드로 가져가 버린 경우에도 '넘겼습니다' 로 잘못 보고된다.
    const { data: moved, error } = await supabase
      .from('jobs')
      .update({ author_id: profileId, claimed_at: new Date().toISOString(), claim_code: null })
      .eq('id', id)
      .is('author_id', null)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: '이관에 실패했습니다.' }, { status: 500 });
    if (!moved) {
      return NextResponse.json(
        { error: '이미 다른 계정이 가져갔거나 존재하지 않는 공고입니다.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // 코드 재발급
  if (body.action === 'regenerate-code') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const code = makeClaimCode();
    // 저장되지 않은 코드를 관리자에게 보여주면 업체에 무효한 코드를 전달하게 된다.
    const { data: updated, error } = await supabase
      .from('jobs')
      .update({ claim_code: code })
      .eq('id', id)
      .is('author_id', null)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: '코드 재발급에 실패했습니다.' }, { status: 500 });
    if (!updated) {
      return NextResponse.json(
        { error: '이미 업체가 가져갔거나 삭제된 공고입니다. 목록을 새로고침해주세요.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, claimCode: code });
  }

  if (body.action === 'create') {
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    const consentNote = typeof body.consentNote === 'string' ? body.consentNote.trim() : '';

    if (!companyName) return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
    if (!contact) return NextResponse.json({ error: '업체 연락처를 입력해주세요.' }, { status: 400 });
    // 동의 기록은 이 기능의 법적 근거다 — 비워둘 수 없다.
    if (consentNote.length < 5) {
      return NextResponse.json(
        { error: '동의를 받은 경위를 적어주세요. (예: 2026-07-26 전화 통화, 예약실 김○○ 실장 동의)' },
        { status: 400 },
      );
    }

    const parsed = readJobFields(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const claimCode = makeClaimCode();
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        id: randomUUID(),
        author_id: null, // 아직 주인이 없다
        posting_type: 'hiring',
        ...parsed.fields,
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
