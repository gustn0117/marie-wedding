// 리뷰 작성 가능 기간 — 서버 RPC(submit_review)와 동일 규칙:
// 양쪽 '진행 완료' 중 나중 시각 + 30일이 지나면 마감. 이 창을 UI 게이트에도 반영해,
// 만료된 거래에 리뷰 작성을 계속 유도하다 제출만 실패하는 상황을 없앤다.
export const REVIEW_WINDOW_DAYS = 30;

export function reviewWindowOpen(
  hiringCompletedAt: string | null | undefined,
  applicantCompletedAt: string | null | undefined,
): boolean {
  if (!hiringCompletedAt || !applicantCompletedAt) return false;
  const completedAt = Math.max(
    new Date(hiringCompletedAt).getTime(),
    new Date(applicantCompletedAt).getTime(),
  );
  // duration 기반 비교라 타임존 무관(UTC epoch 산술).
  return completedAt + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000 > Date.now();
}
