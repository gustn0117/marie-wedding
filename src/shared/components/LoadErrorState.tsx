'use client';

// 서버 조회 실패를 "데이터 없음"으로 오인시키지 않기 위한 공용 에러 상태.
// 빈 상태(EmptyState)와 명확히 구분되며 '다시 시도'로 현재 페이지를 재요청한다.
export default function LoadErrorState({
  message = '불러오지 못했습니다.',
  hint = '잠시 후 다시 시도해주세요.',
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div className="platform-panel px-6 py-12 text-center">
      <p className="text-sm font-bold text-gray-700">{message}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-outline mt-4 text-sm"
      >
        다시 시도
      </button>
    </div>
  );
}
