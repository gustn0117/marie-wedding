import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 대행 등록 프로필 — 업체 동의를 받아 관리자가 대신 만든 디렉토리 등재.
 *
 * 공고와 달리 프로필은 '주인 바꾸기'로 넘길 수 없다. profiles.id 를 참조하는 테이블이
 * 28개라 업체가 이미 가진 프로필과 충돌하기 때문이다(한 사람에 프로필 둘).
 * 그래서 이관은 **내용을 옮기는 방식**이다 — 대행 프로필의 내용을 업체 프로필의
 * 빈 항목에 채워 넣고, 대행 프로필은 정리한다.
 * 업체가 이미 적어둔 값은 덮지 않는다(남의 소개를 관리자가 지우면 안 된다).
 */

/** 디렉토리 등재에 쓰이는 항목만. 계정 관리용 필드(연락처·인증서류 등)는 다루지 않는다. */
const LISTING_FIELDS = [
  'company_name', 'contact_name', 'business_type', 'region',
  'bio', 'address', 'website', 'company_size', 'established_year',
  'profile_image', 'cover_image',
] as const;

function readListing(body: Record<string, unknown>) {
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  return {
    company_name: str(body.companyName, 100),
    contact_name: str(body.contactName, 50),
    business_type: str(body.businessType, 200),
    region: str(body.region, 100),
    bio: str(body.bio, 5000),
    address: str(body.address, 200),
    website: str(body.website, 200),
    company_size: str(body.companySize, 50),
    established_year: str(body.establishedYear, 10),
    profile_image: str(body.profileImage, 300),
    cover_image: str(body.coverImage, 300),
    gallery: readGallery(body.gallery),
  };
}

/** 갤러리는 스토리지 경로 배열. 폼과 같은 12장 상한을 서버에서도 지킨다. */
function readGallery(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const paths = value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 300))
    .slice(0, 12);
  return paths.length > 0 ? paths : null;
}

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const supabase = createServiceClient();

  // 이관 대상 업체 후보(가입한 업체 회원)
  if (url.searchParams.get('candidates') === '1') {
    const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 60);
    let cq = supabase
      .from('profiles')
      .select('id, company_name, contact_name, region, business_type, created_at')
      .eq('account_type', 'business')
      .not('user_id', 'is', null) // 대행 프로필(주인 없음)은 대상이 아니다
      .is('deleted_at', null)
      .is('banned_at', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (q) cq = cq.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`);
    const { data, error } = await cq;
    if (error) return NextResponse.json({ error: '업체 목록을 불러오지 못했습니다.' }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  // 단건(수정 화면용)
  const one = url.searchParams.get('id');
  if (one) {
    const { data } = await supabase.from('profiles').select('*').eq('id', one).maybeSingle();
    if (!data) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    if (data.user_id) return NextResponse.json({ error: '대행 등록 프로필이 아닙니다.' }, { status: 403 });
    return NextResponse.json({ profile: data });
  }

  const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 100);
  let query = supabase
    .from('profiles')
    .select('id, company_name, contact_name, business_type, region, proxy_contact, proxy_consent_note, proxy_consent_at, claimed_at, is_directory_listed, created_at, deleted_at', { count: 'exact' })
    .is('user_id', null); // 주인 없는 프로필 = 대행 등록분
  if (url.searchParams.get('showDeleted') !== '1') query = query.is('deleted_at', null);
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`);

  const { data, count, error } = await query.order('created_at', { ascending: false }).limit(100);
  if (error) {
    console.error('[api/admin/proxy-profiles] list failed:', error);
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [], count: count ?? 0 });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const supabase = createServiceClient();

  if (body.action === 'create') {
    const contact = typeof body.proxyContact === 'string' ? body.proxyContact.trim() : '';
    const consentNote = typeof body.consentNote === 'string' ? body.consentNote.trim() : '';
    const listing = readListing(body);

    if (!listing.company_name) return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });
    if (!listing.contact_name) return NextResponse.json({ error: '담당자명을 입력해주세요.' }, { status: 400 });
    if (!listing.business_type) return NextResponse.json({ error: '업종을 선택해주세요.' }, { status: 400 });
    if (!listing.region) return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });
    if (!contact) return NextResponse.json({ error: '업체 연락처를 입력해주세요.' }, { status: 400 });
    if (consentNote.length < 5) {
      return NextResponse.json(
        { error: '동의를 받은 경위를 적어주세요. (예: 2026-07-27 전화 통화, 김○○ 실장 동의)' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: null, // 아직 주인이 없다
        account_type: 'business',
        ...listing,
        is_directory_listed: true,
        onboarded_at: new Date().toISOString(), // 온보딩 개념이 없는 등재용 프로필
        proxy_contact: contact.slice(0, 200),
        proxy_consent_note: consentNote.slice(0, 1000),
        proxy_consent_at: new Date().toISOString(),
        proxy_created_by: 'admin',
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[api/admin/proxy-profiles] create failed:', error);
      return NextResponse.json({ error: `등록에 실패했습니다: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (body.action === 'update') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { data: existing } = await supabase
      .from('profiles').select('id, user_id, deleted_at').eq('id', id).maybeSingle();
    if (!existing) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
    if (existing.user_id) return NextResponse.json({ error: '대행 등록 프로필만 수정할 수 있습니다.' }, { status: 403 });
    if (existing.deleted_at) return NextResponse.json({ error: '삭제된 프로필은 수정할 수 없습니다.' }, { status: 400 });

    const listing = readListing(body);
    if (!listing.company_name) return NextResponse.json({ error: '업체명을 입력해주세요.' }, { status: 400 });

    const patch: Record<string, unknown> = { ...listing, updated_at: new Date().toISOString() };
    if (typeof body.proxyContact === 'string' && body.proxyContact.trim()) {
      patch.proxy_contact = body.proxyContact.trim().slice(0, 200);
    }
    if (typeof body.consentNote === 'string') {
      const v = body.consentNote.trim();
      if (v.length < 5) return NextResponse.json({ error: '동의를 받은 경위를 적어주세요. (5자 이상)' }, { status: 400 });
      patch.proxy_consent_note = v.slice(0, 1000);
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete' || body.action === 'restore') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { data: row, error } = await supabase
      .from('profiles')
      .update({ deleted_at: body.action === 'delete' ? new Date().toISOString() : null })
      .eq('id', id)
      .is('user_id', null) // 실제 회원 프로필은 이 경로로 손대지 않는다
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 });
    if (!row) return NextResponse.json({ error: '대행 등록 프로필을 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // 이관 — 대행 프로필 내용을 업체 프로필의 '빈 항목'에만 채워 넣는다.
  if (body.action === 'assign') {
    const id = typeof body.id === 'string' ? body.id : '';
    const targetId = typeof body.profileId === 'string' ? body.profileId : '';
    if (!id || !targetId) return NextResponse.json({ error: 'id 와 profileId 가 필요합니다.' }, { status: 400 });

    const { data: proxy } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (!proxy || proxy.user_id) {
      return NextResponse.json({ error: '대행 등록 프로필을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (proxy.deleted_at) return NextResponse.json({ error: '삭제된 프로필은 넘길 수 없습니다.' }, { status: 400 });

    const { data: target } = await supabase
      .from('profiles').select('*').eq('id', targetId).is('deleted_at', null).maybeSingle();
    if (!target) return NextResponse.json({ error: '대상 업체를 찾을 수 없습니다.' }, { status: 404 });
    if (!target.user_id) return NextResponse.json({ error: '가입한 업체에게만 넘길 수 있습니다.' }, { status: 400 });

    // 업체가 이미 적어둔 값은 그대로 둔다. 비어 있는 항목만 채운다.
    const patch: Record<string, unknown> = {};
    const filled: string[] = [];
    for (const f of LISTING_FIELDS) {
      const cur = target[f as keyof typeof target];
      const next = proxy[f as keyof typeof proxy];
      if (next && (cur === null || cur === undefined || cur === '')) {
        patch[f] = next;
        filled.push(f);
      }
    }
    if (proxy.gallery && (!target.gallery || target.gallery.length === 0)) {
      patch.gallery = proxy.gallery;
      filled.push('gallery');
    }
    patch.is_directory_listed = true;
    patch.updated_at = new Date().toISOString();

    const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', targetId);
    if (upErr) {
      console.error('[api/admin/proxy-profiles] merge failed:', upErr);
      return NextResponse.json({ error: '내용을 옮기지 못했습니다.' }, { status: 500 });
    }

    // 대행 프로필은 정리한다(관리자가 만든 등재용이라 딸린 데이터가 없다).
    await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), is_directory_listed: false, claimed_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ ok: true, filled, targetId });
  }

  return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
}
