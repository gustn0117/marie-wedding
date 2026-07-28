'use client';

/** 대행 등록에만 필요한 정보 — 프로필 내용이 아니라서 폼 바깥에서 받는다. */
export interface ProxyMeta {
  contact: string;
  consentNote: string;
}

export const PROXY_UPLOAD_ENDPOINTS = {
  avatar: '/api/admin/upload-image?target=profile-avatar',
  cover: '/api/admin/upload-image?target=profile-cover',
  gallery: '/api/admin/upload-image?target=profile-gallery',
  content: '/api/admin/upload-image?target=profile-content',
};

export default function ProxyMetaPanel({
  value, onChange,
}: { value: ProxyMeta; onChange: (v: ProxyMeta) => void }) {
  return (
    <div id="proxy-meta" className="rounded border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-800 text-xs font-bold text-white">＊</span>
        <h2 className="text-base font-bold text-gray-900 sm:text-lg">대행 정보</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500 sm:ml-8 sm:text-sm">
        업체에는 보이지 않고 관리자만 봅니다. 동의 기록은 법적 근거로 남습니다.
      </p>
      <div className="space-y-4 sm:ml-8">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-800">
            업체 연락처<span className="ml-0.5 text-state-urgent">*</span>
          </label>
          <input
            value={value.contact}
            onChange={(e) => onChange({ ...value, contact: e.target.value })}
            placeholder="예) 02-000-0000 / 담당 김실장"
            className="w-full rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-800">
            동의를 받은 경위<span className="ml-0.5 text-state-urgent">*</span>
          </label>
          <textarea
            value={value.consentNote}
            onChange={(e) => onChange({ ...value, consentNote: e.target.value })}
            rows={2}
            placeholder="예) 2026-07-28 전화 통화, 예약실 김○○ 실장이 프로필 대신 등록에 동의"
            className="w-full resize-y rounded border border-gray-300 px-4 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            동의 없이 다른 사이트의 업체 정보를 옮겨오면 데이터베이스제작자 권리 침해입니다(서울고법, 잡코리아 대 사람인).
          </p>
        </div>
      </div>
    </div>
  );
}
