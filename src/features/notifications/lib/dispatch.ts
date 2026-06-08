/**
 * 클라이언트 측 알림 디스패처 (fire-and-forget).
 *
 * 거래 mutation 성공 후 호출.
 * 메일 발송 실패가 거래 흐름을 막지 않게 try/catch로 swallow.
 */

async function fire(url: string): Promise<void> {
  try {
    await fetch(url, { method: 'POST', credentials: 'same-origin', keepalive: true });
  } catch {
    /* swallow — 알림 실패는 거래에 영향 없음 */
  }
}

export const notify = {
  quotationSent(quotationId: string) {
    fire(`/api/notifications/quotation/${quotationId}/sent`);
  },
  quotationAccepted(quotationId: string) {
    fire(`/api/notifications/quotation/${quotationId}/accepted`);
  },
  quotationRejected(quotationId: string) {
    fire(`/api/notifications/quotation/${quotationId}/rejected`);
  },
  contractSignatureRequest(contractId: string) {
    fire(`/api/notifications/contract/${contractId}/signature_request`);
  },
  contractSigned(contractId: string) {
    fire(`/api/notifications/contract/${contractId}/signed`);
  },
  settlementPaid(settlementId: string) {
    fire(`/api/notifications/settlement/${settlementId}/paid`);
  },
};
