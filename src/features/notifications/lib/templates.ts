/**
 * 자동 발송 이메일 템플릿 (server-only).
 * 무채색 미니멀 스타일 + 브랜드 포인트(네이비). 인라인 스타일만 사용(메일 클라이언트 호환).
 */

const BRAND = '#1a2b4a';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shell(bodyInner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
    ${bodyInner}
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
    <p style="font-size:12px;color:#999;margin:0">마리에(Marié) · 웨딩업계 구인구직 플랫폼</p>
  </div>`;
}

/** 이메일 인증번호 메일 */
export function emailOtpEmail(code: string): { subject: string; html: string; text: string } {
  const subject = '[마리에] 이메일 인증번호';
  const html = shell(`
    <h2 style="color:${BRAND};margin:0 0 16px;font-size:20px">이메일 인증번호</h2>
    <p style="line-height:1.7;font-size:15px;margin:0 0 16px">아래 인증번호를 회원가입 화면에 입력해주세요. (3분 이내 유효)</p>
    <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:${BRAND};background:#f6f7f9;border-radius:8px;padding:18px 0;text-align:center">${escapeHtml(code)}</div>
    <p style="line-height:1.7;font-size:13px;color:#999;margin:16px 0 0">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
  `);
  const text = `마리에 이메일 인증번호: ${code} (3분 이내 유효)`;
  return { subject, html, text };
}

/** 회원가입 환영 메일 */
export function welcomeEmail(name: string): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(name || '회원');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://marie.co.kr';
  const subject = '[마리에] 가입을 환영합니다';
  const html = shell(`
    <h2 style="color:${BRAND};margin:0 0 16px;font-size:20px">${safeName}님, 마리에에 오신 것을 환영합니다 🎉</h2>
    <p style="line-height:1.7;font-size:15px;margin:0 0 12px">웨딩업계 채용·프로필·커뮤니티를 한곳에서 이용하실 수 있습니다.</p>
    <p style="line-height:1.7;font-size:15px;margin:0 0 20px">지금 프로필을 채우고 채용 공고를 둘러보세요.</p>
    <a href="${appUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px">마리에 바로가기</a>
  `);
  const text = `${name}님, 마리에에 오신 것을 환영합니다.\n웨딩업계 채용·프로필·커뮤니티를 한곳에서 이용하실 수 있습니다.\n${appUrl}`;
  return { subject, html, text };
}

/** 새 지원자 도착 메일 (채용자에게) */
export function newApplicationEmail(input: {
  jobTitle: string;
  applicantName: string;
  applicationsUrl: string;
}): { subject: string; html: string; text: string } {
  const jobTitle = escapeHtml(input.jobTitle);
  const applicantName = escapeHtml(input.applicantName);
  const subject = `[마리에] 새 지원자 · ${jobTitle}`;
  const html = shell(`
    <h2 style="color:${BRAND};margin:0 0 16px;font-size:20px">새 지원자가 도착했습니다</h2>
    <p style="line-height:1.7;font-size:15px;margin:0 0 8px"><strong>${applicantName}</strong>님이 아래 공고에 지원했습니다.</p>
    <p style="line-height:1.7;font-size:15px;margin:0 0 20px;padding:12px 14px;background:#f6f7f9;border-radius:6px">${jobTitle}</p>
    <a href="${input.applicationsUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px">지원자 확인하기</a>
  `);
  const text = `새 지원자가 도착했습니다.\n${input.applicantName}님이 "${input.jobTitle}" 공고에 지원했습니다.\n${input.applicationsUrl}`;
  return { subject, html, text };
}
