import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/features/notifications/lib/email';
import { hasValidAdminSession } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 10;
const STALE_CLAIM_MS = 75_000;
const ACTIVE_CLAIM_POLL_MS = 5_000;
const UNCERTAIN_ERROR = 'delivery_outcome_unknown_after_worker_interruption_not_retried';

type Target = 'all' | 'business' | 'individual';
type Campaign = {
  id: string;
  subject: string;
  message: string;
  target: Target;
  recipients_ready: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function campaignHtml(subject: string, message: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="color:#1a2b4a;margin:0 0 16px">${escapeHtml(subject)}</h2>
    <div style="white-space:pre-wrap;line-height:1.7;color:#333;font-size:15px">${escapeHtml(message)}</div>
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
    <p style="font-size:12px;color:#999;margin:0">마리에(Marié) · 본 메일은 안내 목적으로 발송되었습니다.</p>
  </div>`;
}

async function prepareRecipients(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: Campaign,
) {
  const userIds = new Set<string>();
  for (let offset = 0; offset < 100_000; offset += 1000) {
    let query = supabase
      .from('profiles')
      .select('user_id, account_type')
      .is('deleted_at', null)
      .not('user_id', 'is', null)
      .order('user_id', { ascending: true })
      .range(offset, offset + 999);
    if (campaign.target !== 'all') query = query.eq('account_type', campaign.target);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    for (const profile of data ?? []) if (profile.user_id) userIds.add(profile.user_id);
    if ((data?.length ?? 0) < 1000) break;
  }

  const deliveries: Array<{ campaign_id: string; user_id: string; email: string }> = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      if (userIds.has(user.id) && user.email) {
        deliveries.push({ campaign_id: campaign.id, user_id: user.id, email: user.email });
      }
    }
    if (data.users.length < 1000) break;
  }

  for (let start = 0; start < deliveries.length; start += 500) {
    const { error } = await supabase
      .from('admin_broadcast_deliveries')
      .upsert(deliveries.slice(start, start + 500), {
        onConflict: 'campaign_id,user_id',
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from('admin_broadcast_campaigns')
    .update({ recipients_ready: true, recipient_count: deliveries.length })
    .eq('id', campaign.id);
  if (error) throw new Error(error.message);
}

async function statusCounts(supabase: ReturnType<typeof createServiceClient>, campaignId: string) {
  const statuses = ['pending', 'sending', 'sent', 'failed', 'uncertain'] as const;
  const counts = await Promise.all(statuses.map(async (status) => {
    const { count, error } = await supabase
      .from('admin_broadcast_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', status);
    if (error) throw new Error(error.message);
    return [status, count ?? 0] as const;
  }));
  return Object.fromEntries(counts) as Record<(typeof statuses)[number], number>;
}

async function recoverStaleClaims(
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
) {
  const recovery = {
    status: 'uncertain',
    error: UNCERTAIN_ERROR,
    sent_at: null,
  };
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();

  // claimed_at 없는 sending 행은 정상 worker가 만든 상태가 아니므로 즉시 회수한다.
  const { error: nullClaimError } = await supabase
    .from('admin_broadcast_deliveries')
    .update(recovery)
    .eq('campaign_id', campaignId)
    .eq('status', 'sending')
    .is('claimed_at', null);
  if (nullClaimError) throw new Error(nullClaimError.message);

  // SMTP/Resend가 메일을 받은 뒤 상태 저장만 실패했을 수도 있다. 재전송하면
  // 중복 가능성이 있으므로 충분한 lease 이후 outcome-unknown terminal로 둔다.
  const { error: staleClaimError } = await supabase
    .from('admin_broadcast_deliveries')
    .update(recovery)
    .eq('campaign_id', campaignId)
    .eq('status', 'sending')
    .lt('claimed_at', staleBefore);
  if (staleClaimError) throw new Error(staleClaimError.message);
}

export async function POST(req: Request) {
  if (!await hasValidAdminSession()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    campaignId?: unknown;
    subject?: unknown;
    message?: unknown;
    target?: unknown;
  } | null;
  const campaignId = typeof body?.campaignId === 'string' ? body.campaignId : '';
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const target = body?.target;
  if (
    !UUID_RE.test(campaignId)
    || !subject
    || !message
    || subject.length > 120
    || message.length > 5000
    || (target !== 'all' && target !== 'business' && target !== 'individual')
  ) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  // 클라이언트 연결이 끊겨도 이미 발송한 건의 상태 기록은 끝낸다.
  const deadline = AbortSignal.timeout(50_000);
  const stopAt = Date.now() + 42_000;
  const supabase = createServiceClient(deadline);

  const { error: insertError } = await supabase
    .from('admin_broadcast_campaigns')
    .insert({ id: campaignId, subject, message, target });
  if (insertError && insertError.code !== '23505') {
    return NextResponse.json({ error: 'campaign_create_failed' }, { status: 500 });
  }

  const { data: stored, error: campaignError } = await supabase
    .from('admin_broadcast_campaigns')
    .select('id, subject, message, target, recipients_ready')
    .eq('id', campaignId)
    .single();
  if (campaignError || !stored) return NextResponse.json({ error: 'campaign_not_found' }, { status: 500 });
  const campaign = stored as Campaign;
  if (campaign.subject !== subject || campaign.message !== message || campaign.target !== target) {
    return NextResponse.json({ error: 'campaign_payload_mismatch' }, { status: 409 });
  }

  try {
    if (!campaign.recipients_ready) await prepareRecipients(supabase, campaign);
    await recoverStaleClaims(supabase, campaignId);
    const html = campaignHtml(subject, message);

    while (Date.now() < stopAt) {
      const { data: pending, error } = await supabase
        .from('admin_broadcast_deliveries')
        .select('user_id, email, attempts')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('user_id')
        .limit(BATCH_SIZE);
      if (error) throw new Error(error.message);
      if (!pending?.length) {
        const { count: activeClaims, error: activeError } = await supabase
          .from('admin_broadcast_deliveries')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'sending');
        if (activeError) throw new Error(activeError.message);
        if ((activeClaims ?? 0) > 0 && Date.now() + ACTIVE_CLAIM_POLL_MS < stopAt) {
          await new Promise((resolve) => setTimeout(resolve, ACTIVE_CLAIM_POLL_MS));
          await recoverStaleClaims(supabase, campaignId);
        }
        break;
      }

      const claimed = [] as Array<{ user_id: string; email: string }>;
      for (const delivery of pending) {
        const { data } = await supabase
          .from('admin_broadcast_deliveries')
          .update({ status: 'sending', attempts: delivery.attempts + 1, claimed_at: new Date().toISOString() })
          .eq('campaign_id', campaignId)
          .eq('user_id', delivery.user_id)
          .eq('status', 'pending')
          .select('user_id, email')
          .maybeSingle();
        if (data) claimed.push(data);
      }

      await Promise.all(claimed.map(async (delivery) => {
        const result = await sendEmail({ to: delivery.email, subject, html, text: message });
        const update = result.ok
          ? { status: 'sent', provider_id: result.id ?? null, error: null, sent_at: new Date().toISOString() }
          : { status: 'failed', provider_id: null, error: (result.error ?? 'send_failed').slice(0, 500), sent_at: null };
        const { error: statusError } = await supabase
          .from('admin_broadcast_deliveries')
          .update(update)
          .eq('campaign_id', campaignId)
          .eq('user_id', delivery.user_id)
          .eq('status', 'sending');
        if (statusError) {
          // 다음 호출의 stale recovery가 결과 불명으로 회수한다. 여기서 pending으로
          // 되돌리면 provider 성공 뒤 DB 응답만 유실된 경우 중복 발송된다.
          console.error('[admin/broadcast] delivery status write failed:', statusError.message);
        }
      }));
    }

    const counts = await statusCounts(supabase, campaignId);
    const done = counts.pending === 0 && counts.sending === 0;
    if (done) {
      await supabase.from('admin_broadcast_campaigns')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', campaignId);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return NextResponse.json({
      ok: true,
      ...counts,
      // 기존 관리자 화면도 결과 불명을 성공으로 표시하지 않도록 failed 합계에
      // 포함하고, 새 클라이언트는 confirmedFailed/uncertain을 구분할 수 있다.
      confirmedFailed: counts.failed,
      failed: counts.failed + counts.uncertain,
      total,
      done,
      retryAfterMs: counts.sending > 0 ? ACTIVE_CLAIM_POLL_MS : 0,
    });
  } catch (error) {
    console.error('[admin/broadcast] failed:', error);
    return NextResponse.json({ error: 'broadcast_processing_failed' }, { status: 500 });
  }
}
