import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getVerifiedProfile } from '@/lib/supabase/verified-profile';
import { sendEmail } from '@/features/notifications/lib/email';
import { newApplicationEmail } from '@/features/notifications/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * 새 지원자 도착 알림 이메일 — 지원 접수 직후 클라이언트가 호출.
 * 채용 공고 작성자(author)의 auth 이메일로 발송한다.
 * 남용 방지: 검증된 Supabase 세션의 프로필 id가 해당 지원서의 지원자와 일치해야 한다.
 * Body: { applicationId }
 */
export async function POST(req: Request) {
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
  try {
    const { applicationId } = await req.json().catch(() => ({}));
    if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

    const caller = await getVerifiedProfile(signal);
    if (!caller.ok) {
      if (caller.reason === 'timeout') return NextResponse.json({ error: 'auth_timeout' }, { status: 504 });
      if (caller.reason === 'server_error') return NextResponse.json({ error: 'auth_failed' }, { status: 503 });
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const callerId = caller.profileId;

    const supabase = createServiceClient(signal);

    // 지원서 → 공고 → 작성자
    const { data: app } = await supabase
      .from('applications')
      .select('id, applicant_id, job:jobs!inner(id, title, author_id)')
      .eq('id', applicationId)
      .abortSignal(signal)
      .single();

    if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (app.applicant_id !== callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = (Array.isArray(app.job) ? app.job[0] : app.job) as any;
    if (!job?.author_id) return NextResponse.json({ ok: true, sent: false });

    // 작성자 프로필 → user_id, 지원자 이름
    const [{ data: author }, { data: applicant }] = await Promise.all([
      supabase.from('profiles').select('user_id').eq('id', job.author_id).abortSignal(signal).maybeSingle(),
      supabase.from('profiles').select('company_name, contact_name').eq('id', callerId).abortSignal(signal).maybeSingle(),
    ]);
    if (!author?.user_id) return NextResponse.json({ ok: true, sent: false });

    const { data: authUser } = await supabase.auth.admin.getUserById(author.user_id);
    const email = authUser?.user?.email;
    if (!email) return NextResponse.json({ ok: true, sent: false });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://marie.co.kr';
    const applicantName = applicant?.company_name || applicant?.contact_name || '지원자';
    const { subject, html, text } = newApplicationEmail({
      jobTitle: job.title ?? '채용 공고',
      applicantName,
      applicationsUrl: `${appUrl}/jobs/${job.id}`,
    });
    const r = await sendEmail({ to: email, subject, html, text });
    return NextResponse.json({ ok: true, sent: r.ok });
  } catch (err) {
    console.error('[notify/application] failed:', err);
    return NextResponse.json({ error: signal.aborted ? 'timeout' : 'failed' }, { status: signal.aborted ? 504 : 500 });
  }
}
