import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hasValidAdminSession } from '@/lib/admin-session';
import {
  getFaxAdapter,
  normalizeFaxNumber,
  isValidFaxNumber,
  isWithinAllowedSendWindow,
} from '@/lib/fax/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = 50;

// ── 목록 / 수신처 집계 ────────────────────────────────────────────────
export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const supabase = createServiceClient();

  // 연결 상태 — 화면 배너가 실제 설정을 반영하도록 서버에서 알려준다(키 값은 내보내지 않는다).
  if (url.searchParams.get('config') === '1') {
    const provider = process.env.FAX_PROVIDER || 'console';
    const hasKeys = provider === 'solapi'
      ? !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET)
      : provider === 'popbill'
        ? !!(process.env.POPBILL_LINK_ID && process.env.POPBILL_SECRET_KEY)
        : false;
    const from = normalizeFaxNumber(process.env.FAX_SEND_NUMBER || '');
    return NextResponse.json({
      provider,
      ready: provider === 'solapi' && hasKeys && !!from,
      hasKeys,
      from,
      // 010 으로 시작하면 팩스번호가 아니라 휴대폰이다 — 발신번호로 거부될 수 있어 알린다.
      senderIsMobile: from.startsWith('010'),
    });
  }

  // 이미 보낸 수신처 맵 — 작성 시 중복 발송 경고용(메일함과 같은 방식)
  if (url.searchParams.get('recipients') === '1') {
    const { data } = await supabase
      .from('admin_fax')
      .select('to_number, created_at')
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(5000);
    const recipients: Record<string, { at: string; count: number }> = {};
    for (const row of data ?? []) {
      const n = normalizeFaxNumber(row.to_number || '');
      if (!n) continue;
      if (recipients[n]) recipients[n].count += 1;
      else recipients[n] = { at: row.created_at, count: 1 };
    }
    return NextResponse.json({ recipients });
  }

  // 수신거부 목록
  if (url.searchParams.get('optout') === '1') {
    const { data } = await supabase
      .from('fax_optout')
      .select('number, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    return NextResponse.json({ items: data ?? [] });
  }

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const from = (page - 1) * PAGE;
  const q = (url.searchParams.get('q') || '').replace(/[,()%_\\]/g, ' ').trim().slice(0, 100);

  let query = supabase
    .from('admin_fax')
    .select('id, to_number, subject, file_path, page_count, status, provider, provider_id, error, created_at, sent_at', { count: 'exact' });
  if (q) {
    query = query.or(`to_number.ilike.%${q}%,subject.ilike.%${q}%`);
  }
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);

  let rows = data ?? [];
  let total = count ?? 0;
  if (error) {
    // 마지막 페이지 뒤 요청은 PostgREST 가 416(PGRST103) 을 준다 — 빈 페이지로 응답(메일함과 동일).
    if (error.code !== 'PGRST103') {
      console.error('[api/admin/fax] list failed:', error);
      return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 });
    }
    let countQuery = supabase.from('admin_fax').select('id', { count: 'exact', head: true });
    if (q) countQuery = countQuery.or(`to_number.ilike.%${q}%,subject.ilike.%${q}%`);
    const { count: c } = await countQuery;
    rows = [];
    total = c ?? 0;
  }

  return NextResponse.json({ items: rows, count: total, page, pageSize: PAGE });
}

// ── 액션(발송 / 삭제 / 수신거부) ──────────────────────────────────────
export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const supabase = createServiceClient();

  if (body.action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : null;
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
    const { error } = await supabase.from('admin_fax').delete().eq('id', id);
    if (error) return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 수신거부 등록/해제 — 등록된 번호는 발송 자체가 거부된다.
  if (body.action === 'optout-add') {
    const n = normalizeFaxNumber(typeof body.number === 'string' ? body.number : '');
    if (!n) return NextResponse.json({ error: '번호가 올바르지 않습니다.' }, { status: 400 });
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null;
    const { error } = await supabase.from('fax_optout').upsert({ number: n, reason });
    if (error) return NextResponse.json({ error: '수신거부 등록에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'optout-remove') {
    const n = normalizeFaxNumber(typeof body.number === 'string' ? body.number : '');
    if (!n) return NextResponse.json({ error: '번호가 올바르지 않습니다.' }, { status: 400 });
    const { error } = await supabase.from('fax_optout').delete().eq('number', n);
    if (error) return NextResponse.json({ error: '수신거부 해제에 실패했습니다.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'send') {
    const rawTo = typeof body.to === 'string' ? body.to : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : '';
    const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
    const pageCount = Number.isInteger(body.pageCount) ? (body.pageCount as number) : 1;

    if (!isValidFaxNumber(rawTo)) {
      return NextResponse.json({ error: '팩스번호 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (!subject) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 });
    if (!fileUrl) return NextResponse.json({ error: '보낼 문서를 첨부해주세요.' }, { status: 400 });

    // 야간(21:00~08:00 KST) 광고 팩스는 별도 동의가 필요하다 — 시스템에서 차단.
    if (!isWithinAllowedSendWindow()) {
      return NextResponse.json(
        { error: '광고 팩스는 오전 8시~오후 9시에만 보낼 수 있습니다. 시간을 확인해주세요.' },
        { status: 400 },
      );
    }

    const to = normalizeFaxNumber(rawTo);

    // 수신거부 번호는 발송 자체를 거부한다.
    const { data: blocked } = await supabase
      .from('fax_optout')
      .select('number')
      .eq('number', to)
      .maybeSingle();
    if (blocked) {
      return NextResponse.json({ error: '수신거부한 번호입니다. 발송할 수 없습니다.' }, { status: 400 });
    }

    const adapter = getFaxAdapter();
    const result = await adapter.send({ to, subject, fileUrl });

    // 성공·실패 모두 이력으로 남긴다(실패 사유 포함).
    const { data: inserted } = await supabase
      .from('admin_fax')
      .insert({
        to_number: to,
        subject: subject.slice(0, 500),
        file_path: filePath.slice(0, 500) || null,
        page_count: pageCount > 0 ? pageCount : 1,
        status: result.ok ? 'sent' : 'failed',
        provider: adapter.name,
        provider_id: result.providerId ?? null,
        error: result.error ?? null,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .select('id')
      .maybeSingle();

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? '발송에 실패했습니다.', id: inserted?.id }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: inserted?.id, provider: adapter.name });
  }

  return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 });
}
