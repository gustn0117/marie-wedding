import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1x1 투명 GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pixel() {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      // 이미지 캐시로 열람이 한 번만 잡히지 않게 매번 재요청 유도
      'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

/**
 * 수신확인 추적 픽셀 — 발송 메일의 <img> 가 로드되면(상대가 메일을 열면) 호출된다.
 * opened_at 최초 기록 + open_count 증가. 인증 없음(외부 수신자가 로드). 항상 픽셀 반환.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (UUID_RE.test(id)) {
    try {
      const supabase = createServiceClient();
      await supabase.rpc('mail_track_open', { p_id: id });
    } catch (e) {
      console.error('[api/mail/track] failed:', e);
    }
  }
  return pixel();
}
