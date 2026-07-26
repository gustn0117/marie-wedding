import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 팩스로 보낼 문서 — PDF 또는 이미지.
// 발송 시 서버가 이 URL 로 문서를 내려받아 공급자에 올리므로 공개 버킷을 쓴다(영업용 문서라 민감정보 아님).
// event-images 를 쓰면 그 버킷이 이미지 MIME 만 허용해 PDF 가 저장소 단계에서 거부된다 — 전용 버킷 사용.
const BUCKET = 'fax-documents';
const PREFIX = 'documents';
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * 확장자를 믿지 않고 매직바이트로 판별한다.
 *
 * 팩스 공급자(솔라피)가 받는 형식만 허용한다 — bmp, gif, jpg, tif, doc(x), xls(x),
 * ppt(x), htm(l), hwp, pdf. **png·webp 는 목록에 없다.** 여기서 통과시키면 발송 단계에서
 * "형식의 파일만 사용가능합니다" 로 거부당하므로(실제로 겪음) 업로드 시점에 막는다.
 * png 는 화면에서 업로드 전에 jpg 로 변환해 올린다.
 */
async function detectFormat(file: Blob): Promise<{ ext: string; contentType: string } | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);

  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { ext: 'pdf', contentType: 'application/pdf' }; // %PDF
  if (startsWith([0xff, 0xd8, 0xff])) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return { ext: 'gif', contentType: 'image/gif' }; // GIF8
  if (startsWith([0x42, 0x4d])) return { ext: 'bmp', contentType: 'image/bmp' }; // BM
  if (startsWith([0x49, 0x49, 0x2a, 0x00]) || startsWith([0x4d, 0x4d, 0x00, 0x2a])) {
    return { ext: 'tif', contentType: 'image/tiff' };
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
    return NextResponse.json(
      { error: '팩스로 보낼 수 없는 형식입니다. PDF 또는 JPG 로 올려주세요. (PNG 는 지원되지 않습니다)' },
      { status: 400 },
    );
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
