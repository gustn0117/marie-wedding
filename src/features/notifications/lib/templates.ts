/**
 * 메일 HTML 템플릿 — 미니멀, 인라인 스타일, 모바일 친화.
 * 한국어 본문.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://marie-wedding.hsweb.pics';
const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

interface Branding {
  name: string;
  url: string;
}
const BRAND: Branding = { name: 'Marié', url: APP_URL };

function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  const ctaHtml = cta
    ? `<a href="${cta.href}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px;">${cta.label}</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,'Pretendard',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table cellpadding="0" cellspacing="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #e4e4e7;">
          <a href="${BRAND.url}" style="text-decoration:none;color:#3617ce;font-size:18px;font-weight:800;letter-spacing:-0.3px;">${BRAND.name}</a>
          <p style="margin:2px 0 0;font-size:11px;color:#71717a;">웨딩 업계 B2B 네트워크</p>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.4;">${title}</h1>
          ${bodyHtml}
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e4e4e7;background:#fafafa;">
          <p style="margin:0;font-size:11px;color:#71717a;line-height:1.5;">
            본 메일은 ${BRAND.name} 거래 알림으로 자동 발송되었습니다.<br>
            수신을 원하지 않으시면 <a href="${BRAND.url}/mypage/notifications" style="color:#71717a;text-decoration:underline;">알림 설정</a>에서 변경하세요.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">${text}</p>`;
}

function infoBox(rows: { label: string; value: string }[]) {
  const lines = rows.map((r) =>
    `<tr><td style="padding:6px 0;color:#71717a;width:80px;font-size:12px;">${r.label}</td><td style="padding:6px 0;color:#1a1a1a;font-size:13px;font-weight:600;">${r.value}</td></tr>`
  ).join('');
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:12px 0;padding:16px;background:#fafafa;border-radius:8px;border:1px solid #e4e4e7;">${lines}</table>`;
}

export interface QuotationSentVars {
  receiverName: string;
  senderName: string;
  title: string;
  totalAmount: number;
  eventDate?: string | null;
  validUntil?: string | null;
  quotationId: string;
}
export function quotationSentEmail(vars: QuotationSentVars) {
  const html = shell(
    `${vars.senderName}님이 견적을 보내드렸습니다`,
    p(`${vars.receiverName}님 안녕하세요, ${BRAND.name}입니다.`) +
    p(`<strong>${vars.senderName}</strong>님이 새 견적을 발송했습니다. 내용을 확인하고 응답해 주세요.`) +
    infoBox([
      { label: '견적 제목', value: vars.title },
      { label: '총 금액', value: `${fmt(vars.totalAmount)} 원` },
      ...(vars.eventDate ? [{ label: '예식 일자', value: vars.eventDate }] : []),
      ...(vars.validUntil ? [{ label: '유효 기한', value: vars.validUntil }] : []),
    ]),
    { label: '견적 확인하기', href: `${APP_URL}/quotations/${vars.quotationId}` }
  );
  return { subject: `[${BRAND.name}] ${vars.senderName} 견적 도착 — ${vars.title}`, html };
}

export interface QuotationRespondedVars {
  senderName: string;
  receiverName: string;
  title: string;
  status: 'accepted' | 'rejected';
  reason?: string | null;
  quotationId: string;
}
export function quotationRespondedEmail(vars: QuotationRespondedVars) {
  const isAccepted = vars.status === 'accepted';
  const html = shell(
    `견적이 ${isAccepted ? '승인' : '거절'}되었습니다`,
    p(`${vars.senderName}님 안녕하세요, ${BRAND.name}입니다.`) +
    p(`<strong>${vars.receiverName}</strong>님이 회원님의 견적 <strong>${vars.title}</strong>을 <strong>${isAccepted ? '승인' : '거절'}</strong>했습니다.`) +
    (isAccepted
      ? p('계약을 진행하시려면 견적 상세 페이지에서 <strong>계약으로 전환</strong> 버튼을 눌러주세요.')
      : (vars.reason ? infoBox([{ label: '거절 사유', value: vars.reason }]) : '')),
    { label: '견적 확인하기', href: `${APP_URL}/quotations/${vars.quotationId}` }
  );
  return { subject: `[${BRAND.name}] 견적 ${isAccepted ? '승인' : '거절'} — ${vars.title}`, html };
}

export interface ContractSignatureRequestVars {
  signerName: string;
  counterpartyName: string;
  title: string;
  contractId: string;
  totalAmount: number;
  eventDate: string;
}
export function contractSignatureRequestEmail(vars: ContractSignatureRequestVars) {
  const html = shell(
    `계약서 서명을 부탁드립니다`,
    p(`${vars.signerName}님 안녕하세요, ${BRAND.name}입니다.`) +
    p(`<strong>${vars.counterpartyName}</strong>님과의 계약서가 준비되었습니다. 내용을 검토하고 전자 서명해 주세요.`) +
    infoBox([
      { label: '계약명', value: vars.title },
      { label: '총 금액', value: `${fmt(vars.totalAmount)} 원` },
      { label: '예식 일자', value: vars.eventDate },
    ]),
    { label: '서명하러 가기', href: `${APP_URL}/contracts/${vars.contractId}` }
  );
  return { subject: `[${BRAND.name}] 계약서 서명 요청 — ${vars.title}`, html };
}

export interface ContractSignedVars {
  recipientName: string;
  title: string;
  contractId: string;
  totalAmount: number;
}
export function contractSignedEmail(vars: ContractSignedVars) {
  const html = shell(
    `계약이 체결되었습니다`,
    p(`${vars.recipientName}님 안녕하세요, ${BRAND.name}입니다.`) +
    p(`양 당사자가 모두 서명을 완료하여 계약이 정식 체결되었습니다.`) +
    infoBox([
      { label: '계약명', value: vars.title },
      { label: '총 금액', value: `${fmt(vars.totalAmount)} 원` },
    ]) +
    p(`계약서 PDF는 상세 페이지에서 다운로드하실 수 있습니다. 다음 단계로 캘린더에 예약 등록을 진행해 주세요.`),
    { label: '계약 확인', href: `${APP_URL}/contracts/${vars.contractId}` }
  );
  return { subject: `[${BRAND.name}] 계약 체결 완료 — ${vars.title}`, html };
}

export interface SettlementPaidVars {
  payeeName: string;
  title: string;
  netAmount: number;
  paidAt: string;
  settlementId: string;
}
export function settlementPaidEmail(vars: SettlementPaidVars) {
  const html = shell(
    `정산 송금이 완료되었습니다`,
    p(`${vars.payeeName}님 안녕하세요, ${BRAND.name}입니다.`) +
    p(`아래 정산 건의 송금이 완료되었습니다. 등록된 계좌로 입금되었습니다.`) +
    infoBox([
      { label: '계약명', value: vars.title },
      { label: '실수령액', value: `${fmt(vars.netAmount)} 원` },
      { label: '송금 시각', value: vars.paidAt },
    ]) +
    p(`정산내역서 PDF는 마이페이지 정산에서 다운로드할 수 있습니다.`),
    { label: '정산 내역', href: `${APP_URL}/mypage/settlements` }
  );
  return { subject: `[${BRAND.name}] 정산 송금 완료 — ${fmt(vars.netAmount)}원`, html };
}
