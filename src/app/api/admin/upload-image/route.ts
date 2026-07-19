import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { SUPABASE_SERVER_URL } from '@/lib/supabase/serverUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 256 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

const TARGETS = {
  notice: { bucket: 'job-images', prefix: 'admin/notices' },
  'event-cover': { bucket: 'event-images', prefix: 'admin/covers' },
  'event-content': { bucket: 'event-images', prefix: 'admin/content' },
  // 관리자 메일 본문 이미지 — 공개 버킷이어야 외부 수신자의 메일 클라이언트가 로드한다.
  mail: { bucket: 'event-images', prefix: 'admin/mail' },
} as const;

type Target = keyof typeof TARGETS;

function storageClient(signal: AbortSignal) {
  return createClient(SUPABASE_SERVER_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal }),
    },
  });
}

async function cleanup(bucket: string, path: string): Promise<void> {
  const signal = AbortSignal.timeout(4_000);
  await storageClient(signal).storage.from(bucket).remove([path]).catch(() => undefined);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let value = '';
  for (let index = start; index < end && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

async function inspectImage(file: Blob): Promise<{ extension: 'jpg' | 'png' | 'webp'; contentType: string } | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
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

/** Password-unlock 관리자도 Storage RLS와 무관하게 이미지를 올릴 수 있는 제한된 업로드 경로. */
export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  if (!(await isAdminRequest(signal))) {
    return NextResponse.json(
      { error: signal.aborted ? '관리자 인증 시간이 초과되었습니다.' : '관리자 권한이 필요합니다.' },
      { status: signal.aborted ? 504 : 401 },
    );
  }

  const targetName = new URL(request.url).searchParams.get('target') as Target | null;
  if (!targetName || !Object.prototype.hasOwnProperty.call(TARGETS, targetName)) {
    return NextResponse.json({ error: '지원하지 않는 이미지 용도입니다.' }, { status: 400 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: '최적화된 이미지는 2MB 이하여야 합니다.' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const image = form?.get('image');
  if (!image || typeof image === 'string' || typeof image.arrayBuffer !== 'function') {
    return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '최적화된 이미지는 2MB 이하여야 합니다.' }, { status: 413 });
  }
  const format = await inspectImage(image);
  if (!format) {
    return NextResponse.json({ error: 'JPG, PNG 또는 WebP 이미지만 업로드할 수 있습니다.' }, { status: 415 });
  }

  const target = TARGETS[targetName];
  const path = `${target.prefix}/${crypto.randomUUID()}.${format.extension}`;
  const storage = storageClient(signal);
  const { error } = await storage.storage.from(target.bucket).upload(path, image, {
    cacheControl: '31536000',
    contentType: format.contentType,
    upsert: false,
  });
  if (error || signal.aborted) {
    await cleanup(target.bucket, path);
    return NextResponse.json(
      { error: signal.aborted ? '이미지 업로드가 취소되었거나 시간이 초과되었습니다.' : error?.message },
      { status: signal.aborted ? 504 : 502 },
    );
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${target.bucket}/${path}`;
  return NextResponse.json({ path, url: publicUrl });
}
