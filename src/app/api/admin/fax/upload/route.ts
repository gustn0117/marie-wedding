import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 팩스로 보낼 문서 — PDF 또는 이미지.
// 공급자가 URL 로 문서를 가져가는 방식이라 공개 버킷에 올린다(영업용 문서라 민감정보 아님).
const BUCKET = 'event-images';
const PREFIX = 'admin/fax';
const MAX_BYTES = 15 * 1024 * 1024;

/** 확장자를 믿지 않고 매직바이트로 판별한다. */
async function detectFormat(file: Blob): Promise<{ ext: string; contentType: string } | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);

  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { ext: 'pdf', contentType: 'application/pdf' }; // %PDF
  if (startsWith([0xff, 0xd8, 0xff])) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { ext: 'png', contentType: 'image/png' };
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && head[8] === 0x57 && head[9] === 0x45) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: '파일을 읽지 못했습니다.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '문서는 15MB 이하만 올릴 수 있습니다.' }, { status: 400 });
  }

  const format = await detectFormat(file);
  if (!format) {
    return NextResponse.json({ error: 'PDF 또는 이미지(JPG/PNG/WEBP)만 보낼 수 있습니다.' }, { status: 400 });
  }

  const path = `${PREFIX}/${crypto.randomUUID()}.${format.ext}`;
  const storage = createServiceClient();
  const { error } = await storage.storage.from(BUCKET).upload(path, file, {
    contentType: format.contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    console.error('[api/admin/fax/upload] upload failed:', error);
    return NextResponse.json({ error: '문서 업로드에 실패했습니다.' }, { status: 500 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return NextResponse.json({ ok: true, path, url, kind: format.ext });
}
