import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 관리자 회원 프로필 수정 API — 디렉토리 등재 내용만 고친다.
 *
 * 계정 관리 필드(user_id / account_type / role / phone / 제재·삭제 상태)는 여기서
 * 건드리지 않는다. 내용 수정이 계정 권한·소유권 변경으로 번지면 안 된다.
 * 주인 없는 대행 프로필은 전용 화면(/admin/proxy-profiles)에서 다룬다 —
 * 동의 기록(법적 근거) 검증이 그쪽 경로에만 있다.
 */

/** 디렉토리 등재에 쓰이는 항목만. 대행 프로필 경로와 같은 상한. */
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

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[api/admin/profiles] fetch failed:', error);
    return NextResponse.json({ error: '프로필을 불러오지 못했습니다.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
  if (!data.user_id) {
    return NextResponse.json({ error: '대행 등록 프로필입니다. 대행 등록 프로필 화면에서 수정해주세요.' }, { status: 403 });
  }
  return NextResponse.json({ profile: data });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (body.action !== 'update') return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, user_id, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 });
  if (!existing.user_id) {
    return NextResponse.json({ error: '대행 등록 프로필입니다. 대행 등록 프로필 화면에서 수정해주세요.' }, { status: 403 });
  }
  if (existing.deleted_at) return NextResponse.json({ error: '삭제된 회원의 프로필은 수정할 수 없습니다. 먼저 복원해주세요.' }, { status: 400 });

  const listing = readListing(body);
  // 사용자 폼(DirectoryForm)과 같은 필수 조건. 이름은 NOT NULL 컬럼이라 비울 수 없다.
  if (!listing.contact_name) return NextResponse.json({ error: '이름(담당자명)을 입력해주세요.' }, { status: 400 });
  if (!listing.business_type) return NextResponse.json({ error: '업종을 선택해주세요.' }, { status: 400 });
  if (!listing.region) return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });

  const { error } = await supabase
    .from('profiles')
    .update({ ...listing, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[api/admin/profiles] update failed:', error);
    return NextResponse.json({ error: `수정에 실패했습니다: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
