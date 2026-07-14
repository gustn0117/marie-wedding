import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { isAdminRequest } from '@/lib/admin-auth';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'banners';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 256 * 1024;
const IMAGE_PATH_RE = /^(pc|mobile)\/[a-zA-Z0-9._-]+$/;

interface ImageFormat {
  extension: 'jpg' | 'png' | 'webp';
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < end && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

async function inspectImage(file: Blob): Promise<ImageFormat | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
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
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function storageClient(signal: AbortSignal) {
  return createSbClient(SUPABASE_SERVER_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal }),
    },
  });
}

async function cleanup(path: string): Promise<void> {
  const signal = AbortSignal.timeout(4_000);
  await storageClient(signal).storage.from(BUCKET).remove([path]).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  const operationSignal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
  if (!await isAdminRequest(operationSignal)) {
    return NextResponse.json(
      { error: operationSignal.aborted ? '관리자 인증 시간이 초과되었습니다.' : '관리자 권한이 필요합니다.' },
      { status: operationSignal.aborted ? 504 : 403 },
    );
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: '최적화된 배너 이미지는 2MB 이하여야 합니다.' }, { status: 413 });
  }

  const kind = new URL(request.url).searchParams.get('kind');
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: '이미지 요청을 읽지 못했습니다.' }, { status: 400 });
  const image = form.get('image');
  if (
    (kind !== 'pc' && kind !== 'mobile')
    || !image
    || typeof image === 'string'
    || typeof image.arrayBuffer !== 'function'
    || typeof image.stream !== 'function'
  ) {
    return NextResponse.json({ error: '잘못된 이미지 요청입니다.' }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: '최적화된 배너 이미지는 2MB 이하여야 합니다.' }, { status: 413 });
  }
  const format = await inspectImage(image);
  if (!format) {
    return NextResponse.json({ error: 'JPG, PNG, WebP 이미지만 업로드할 수 있습니다.' }, { status: 415 });
  }

  const path = `${kind}/${crypto.randomUUID()}.${format.extension}`;
  const storage = storageClient(operationSignal);
  const { error } = await storage.storage.from(BUCKET).upload(path, image.stream(), {
    cacheControl: '31536000',
    contentType: format.contentType,
    duplex: 'half',
    upsert: false,
  });
  if (error || operationSignal.aborted) {
    await cleanup(path);
    return NextResponse.json(
      { error: operationSignal.aborted ? '이미지 업로드 시간이 초과되었습니다.' : `이미지 업로드 실패: ${error?.message}` },
      { status: operationSignal.aborted ? 504 : 502 },
    );
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return NextResponse.json({ path, url });
}

export async function DELETE(request: NextRequest) {
  const operationSignal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
  if (!await isAdminRequest(operationSignal)) {
    return NextResponse.json(
      { error: operationSignal.aborted ? '관리자 인증 시간이 초과되었습니다.' : '관리자 권한이 필요합니다.' },
      { status: operationSignal.aborted ? 504 : 403 },
    );
  }
  const body = await request.json().catch(() => null) as { path?: unknown } | null;
  if (typeof body?.path !== 'string' || !IMAGE_PATH_RE.test(body.path)) {
    return NextResponse.json({ error: '이미지 경로가 올바르지 않습니다.' }, { status: 400 });
  }

  const { error } = await storageClient(operationSignal).storage.from(BUCKET).remove([body.path]);
  if (error) {
    return NextResponse.json(
      { error: operationSignal.aborted ? '이미지 정리 시간이 초과되었습니다.' : error.message },
      { status: operationSignal.aborted ? 504 : 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
