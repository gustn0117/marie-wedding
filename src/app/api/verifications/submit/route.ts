import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/authCookie';
import { createServiceClient } from '@/lib/supabase/service';
import { removeVerificationDocument } from '@/lib/verification-document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'verifications';
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_DOCUMENT_BYTES + 512 * 1024;
// 클라이언트의 45초 deadline보다 먼저 실패를 돌려주며 인증/조회/업로드/갱신이 공유한다.
const REQUEST_TIMEOUT_MS = 35_000;

interface DocumentFormat {
  extension: 'jpg' | 'png' | 'webp' | 'pdf' | 'heic' | 'avif';
  contentType: string;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < end && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

async function inspectDocument(file: Blob): Promise<DocumentFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') {
    return { extension: 'pdf', contentType: 'application/pdf' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (
    bytes.length >= 12
    && ascii(bytes, 0, 4) === 'RIFF'
    && ascii(bytes, 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return { extension: 'heic', contentType: 'image/heic' };
    }
    if (['avif', 'avis'].includes(brand)) {
      return { extension: 'avif', contentType: 'image/avif' };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const url = SUPABASE_SERVER_URL;
  const requestSignal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  const cookieStore = await cookies();
  const userSb = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, requestSignal]) : requestSignal,
      }),
    },
    cookieOptions: { name: SUPABASE_AUTH_COOKIE_NAME },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) {
        items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  const { data: userData, error: userErr } = await userSb.auth.getUser();
  if (userErr && requestSignal.aborted) {
    return new NextResponse('인증 서버 응답이 지연되고 있습니다. 다시 시도해 주세요.', { status: 504 });
  }
  if (userErr || !userData.user) return new NextResponse('로그인이 필요합니다.', { status: 401 });

  const adminSb = createServiceClient();

  // 큰 multipart body 를 메모리에 올리기 전에 계정/신청 상태를 먼저 확인한다.
  const { data: profile, error: profErr } = await adminSb
    .from('profiles')
    .select('id, account_type, verification_status, verification_document, banned_at')
    .eq('user_id', userData.user.id)
    .is('deleted_at', null)
    .abortSignal(requestSignal)
    .maybeSingle();
  if (profErr) {
    return new NextResponse(
      requestSignal.aborted ? '서버 응답이 지연되고 있습니다. 다시 시도해 주세요.' : '프로필 정보를 확인하지 못했습니다.',
      { status: requestSignal.aborted ? 504 : 500 },
    );
  }
  if (!profile) return new NextResponse('프로필을 찾을 수 없습니다.', { status: 404 });
  if (profile.banned_at) return new NextResponse('제재된 계정은 이용할 수 없습니다.', { status: 403 });
  if (profile.account_type !== 'business') {
    return new NextResponse('업체 계정만 인증 신청이 가능합니다.', { status: 403 });
  }
  if (profile.verification_status === 'pending') {
    return new NextResponse('이미 검토 중인 신청이 있습니다.', { status: 409 });
  }
  if (profile.verification_status === 'verified') {
    return new NextResponse('이미 인증이 완료된 계정입니다.', { status: 409 });
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return new NextResponse('파일은 8MB 이하로 첨부해 주세요.', { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return new NextResponse('파일을 읽지 못했습니다.', { status: 400 });
  const businessNumberRaw = (form.get('businessNumber') || '').toString().trim();
  const businessNumberDigits = businessNumberRaw.replace(/[^0-9]/g, '');
  const doc = form.get('document');
  if (!doc || typeof doc === 'string' || typeof doc.arrayBuffer !== 'function' || typeof doc.stream !== 'function') {
    return new NextResponse('잘못된 요청입니다.', { status: 400 });
  }
  if (!/^\d{3}-?\d{2}-?\d{5}$/.test(businessNumberRaw) || businessNumberDigits.length !== 10) {
    return new NextResponse('사업자번호 형식이 올바르지 않습니다.', { status: 400 });
  }
  if (doc.size <= 0 || doc.size > MAX_DOCUMENT_BYTES) {
    return new NextResponse('파일은 8MB 이하로 첨부해 주세요.', { status: 413 });
  }
  const format = await inspectDocument(doc);
  if (!format) {
    return new NextResponse('JPG, PNG, WebP, HEIC 또는 PDF 파일만 첨부할 수 있습니다.', { status: 415 });
  }

  // 비공개 버킷에는 service_role 로만 기록한다. stream 을 넘겨 전체 파일의
  // ArrayBuffer/Buffer 복제본을 하나 더 만들지 않는다.
  const path = `${profile.id}/${crypto.randomUUID()}.${format.extension}`;
  const storageSb = createSbClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: requestSignal }),
    },
  });
  const { error: upErr } = await storageSb.storage.from(BUCKET).upload(path, doc.stream(), {
    cacheControl: '0',
    contentType: format.contentType,
    duplex: 'half',
    upsert: false,
  });
  if (upErr) {
    await removeVerificationDocument(path);
    if (requestSignal.aborted) {
      return new NextResponse('업로드 시간이 초과되었습니다. 다시 시도해 주세요.', { status: 504 });
    }
    return new NextResponse('업로드 실패: ' + upErr.message, { status: 502 });
  }

  const businessNumber = `${businessNumberDigits.slice(0, 3)}-${businessNumberDigits.slice(3, 5)}-${businessNumberDigits.slice(5)}`;
  const { data: updated, error: updErr } = await adminSb
    .from('profiles')
    .update({
      verification_status: 'pending',
      verification_document: path,
      verification_submitted_at: new Date().toISOString(),
      verification_reject_reason: null,
      business_number: businessNumber,
    })
    .eq('id', profile.id)
    .in('verification_status', ['unverified', 'rejected'])
    .select('id')
    .abortSignal(requestSignal)
    .maybeSingle();
  if (updErr || !updated) {
    // UPDATE 요청이 서버에 도달한 뒤 응답만 timeout 된 경우 commit 여부를 알 수 없다.
    // 이때 파일을 지우면 성공한 row의 문서 경로가 깨질 수 있으므로 보존한다.
    if (requestSignal.aborted) {
      return new NextResponse('서버 응답이 지연되고 있습니다. 신청 상태를 다시 확인해 주세요.', { status: 504 });
    }
    // 업로드와 상태 변경 사이에 다른 신청이 먼저 들어온 경우 새 객체를 남기지 않는다.
    await removeVerificationDocument(path);
    if (!updated && !updErr) return new NextResponse('이미 처리 중인 신청이 있습니다.', { status: 409 });
    return new NextResponse('업데이트 실패: ' + (updErr?.message || '상태가 변경되었습니다.'), { status: 500 });
  }

  // 재신청으로 문서 경로가 교체된 경우, 새 DB 참조가 확정된 뒤에만 이전 민감
  // 서류를 지운다. UPDATE 결과가 불명확한 위 timeout 분기에서는 둘 다 보존한다.
  if (profile.verification_document && profile.verification_document !== path) {
    await removeVerificationDocument(profile.verification_document);
  }

  return NextResponse.json({ ok: true });
}
