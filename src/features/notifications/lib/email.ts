/**
 * 메일 발송 wrapper (server-only).
 * 우선순위: 자체 SMTP(SMTP_HOST 설정 시) > Resend(RESEND_API_KEY) > 콘솔 폴백(dev).
 * 자체 SMTP 는 호스트 Postfix(+opendkim DKIM 서명) 로 릴레이한다.
 */
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

interface SendInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function mailFrom(): string {
  return (
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM_ADDRESS ||
    'Marié <admin@marie.co.kr>'
  );
}

// ── 1) 자체 SMTP (호스트 Postfix 릴레이) ──────────────────────────────
let smtp: Transporter | null = null;
function getSmtp(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (!smtp) {
    smtp = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 25),
      secure: process.env.SMTP_SECURE === 'true', // 465=true, 25/587=false
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      // 내부망(컨테이너→호스트) 릴레이. Postfix snakeoil 자체서명 인증서라 STARTTLS 검증 완화.
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return smtp;
}

// ── 2) Resend ────────────────────────────────────────────────────────
let resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.includes('xxxxx')) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

export async function sendEmail(input: SendInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const toList = Array.isArray(input.to) ? input.to : [input.to];

  // 1) 자체 SMTP 우선
  const transport = getSmtp();
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: mailFrom(),
        to: toList,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      console.error('[email:smtp] send failed:', err);
      return { ok: false, error: err instanceof Error ? err.message : 'smtp send failed' };
    }
  }

  // 2) Resend
  const r = getResend();
  if (r) {
    try {
      const { data, error } = await r.emails.send({
        from: mailFrom(),
        to: toList,
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

  // 3) dev 콘솔 폴백. 운영에서는 '발송 성공'으로 가장하지 않는다.
  if (process.env.NODE_ENV === 'production') {
    console.error('[email] no SMTP or Resend provider configured');
    return { ok: false, error: 'email_provider_not_configured' };
  }
  console.log('[email:dev]', { to: input.to, subject: input.subject });
  return { ok: true, id: 'dev-skip' };
}
