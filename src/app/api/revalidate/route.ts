import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * 클라이언트 mutation 후 호출 — 다른 페이지의 fetch 캐시 무효화.
 * 예: 공고 수정 → /jobs/[id], /jobs, / 모두 다음 진입 시 fresh fetch.
 */
export async function POST(req: Request) {
  try {
    const { paths } = (await req.json()) as { paths?: string[] };
    if (!Array.isArray(paths)) {
      return NextResponse.json({ error: 'paths array required' }, { status: 400 });
    }
    for (const path of paths) {
      if (typeof path === 'string' && path.startsWith('/')) {
        revalidatePath(path);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 });
  }
}
