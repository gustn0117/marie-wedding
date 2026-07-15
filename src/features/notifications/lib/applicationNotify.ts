import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/features/notifications/lib/email';
import { newApplicationEmail } from '@/features/notifications/lib/templates';

/**
 * 새 지원자 도착 → 채용 공고 작성자에게 알림 이메일(자체 SMTP).
 * best-effort: 실패해도 throw 하지 않고 로그만 남긴다(접수 흐름을 막지 않음).
 * 요청 signal 에 묶지 않아 응답 이후에도 완료된다.
 */
export async function notifyEmployerOfApplication(jobId: string, applicantId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, author_id')
      .eq('id', jobId)
      .maybeSingle();
    if (!job?.author_id || job.author_id === applicantId) return false;

    const [{ data: author }, { data: applicant }] = await Promise.all([
      supabase.from('profiles').select('user_id').eq('id', job.author_id).maybeSingle(),
      supabase.from('profiles').select('company_name, contact_name').eq('id', applicantId).maybeSingle(),
    ]);
    if (!author?.user_id) return false;

    const { data: authUser } = await supabase.auth.admin.getUserById(author.user_id);
    const email = authUser?.user?.email;
    if (!email) return false;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://marie.co.kr';
    const applicantName = applicant?.company_name || applicant?.contact_name || '지원자';
    const { subject, html, text } = newApplicationEmail({
      jobTitle: job.title ?? '채용 공고',
      applicantName,
      applicationsUrl: `${appUrl}/jobs/${job.id}`,
    });
    const r = await sendEmail({ to: email, subject, html, text });
    return r.ok;
  } catch (err) {
    console.error('[notifyEmployerOfApplication] failed:', err);
    return false;
  }
}
