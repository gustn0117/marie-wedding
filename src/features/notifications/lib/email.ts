/**
 * Resend 메일 발송 wrapper (server-only).
 * dev 환경/key 미설정 시 console.log로 폴백 — 주요 알림 흐름을 유지.
 */
import { Resend } from 'resend';

interface SendInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.includes('xxxxx')) return null;
  if (!client) client = new Resend(key);
  return client;
}

export async function sendEmail(input: SendInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const r = getClient();
  if (!r) {
    // dev fallback
    console.log('[email:dev]', { to: input.to, subject: input.subject });
    return { ok: true, id: 'dev-skip' };
  }
  const from = process.env.RESEND_FROM_ADDRESS || 'Marié <noreply@marie-wedding.hsweb.pics>';
  try {
    const { data, error } = await r.emails.send({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}
