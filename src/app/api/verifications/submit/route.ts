import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'verifications';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return new NextResponse('unauthorized', { status: 401 });
  const accessToken = auth.slice('Bearer '.length);

  const url = SUPABASE_SERVER_URL;

  // 1) verify user via anon client + Authorization header
  const userSb = createSbClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr || !userData.user) return new NextResponse('unauthorized', { status: 401 });

  const form = await req.formData();
  const businessNumber = (form.get('businessNumber') || '').toString().trim();
  const doc = form.get('document');
  // ⚠️ Node 18 런타임엔 File 전역이 없어 `doc instanceof File` 이 ReferenceError → 500(빈 본문).
  // FormDataEntryValue 는 string | File 이므로 문자열이 아니면 파일로 판별한다.
  if (!businessNumber || !doc || typeof doc === 'string' || typeof doc.arrayBuffer !== 'function') {
    return new NextResponse('잘못된 요청입니다.', { status: 400 });
  }
  if (!/^[0-9-]{10,14}$/.test(businessNumber)) {
    return new NextResponse('사업자번호 형식이 올바르지 않습니다.', { status: 400 });
  }
  if (doc.size > 5 * 1024 * 1024) {
    return new NextResponse('파일이 5MB를 초과합니다.', { status: 400 });
  }

  const adminSb = createServiceClient();

  // 2) find profile
  const { data: profile, error: profErr } = await adminSb
    .from('profiles')
    .select('id, account_type, verification_status, banned_at')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .single();
  if (profErr || !profile) return new NextResponse('profile not found', { status: 404 });
  if (profile.banned_at) return new NextResponse('제재된 계정은 이용할 수 없습니다.', { status: 403 });
  if (profile.account_type !== 'business') {
    return new NextResponse('업체 계정만 인증 신청이 가능합니다.', { status: 403 });
  }
  if (profile.verification_status === 'pending') {
    return new NextResponse('이미 검토 중인 신청이 있습니다.', { status: 409 });
  }

  // 3) upload image (service_role client, public schema for storage)
  const ext = (doc.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuf = await doc.arrayBuffer();
  const storageSb = createSbClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: upErr } = await storageSb.storage.from(BUCKET).upload(path, Buffer.from(arrayBuf), {
    contentType: doc.type || 'image/jpeg',
    upsert: true,
  });
  if (upErr) return new NextResponse('업로드 실패: ' + upErr.message, { status: 500 });

  // 4) update profile
  const { error: updErr } = await adminSb
    .from('profiles')
    .update({
      verification_status: 'pending',
      verification_document: path,
      verification_submitted_at: new Date().toISOString(),
      verification_reject_reason: null,
      business_number: businessNumber,
    })
    .eq('id', profile.id);
  if (updErr) return new NextResponse('업데이트 실패: ' + updErr.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
