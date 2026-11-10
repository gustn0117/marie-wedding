'use client';

/**
 * [필수] 이용약관·개인정보처리방침 동의 — 이메일 가입 마지막 단계와 소셜 가입 후 온보딩에서 받는다.
 * 약관에는 부적절한 게시물·이용자 무관용 조항이 있다(앱스토어 심사 기준 1.2). 링크는 새 창(앱에서는 앱 안 보기 창)으로
 * 열어 쓰던 내용이 사라지지 않게 한다.
 */
export default function TermsConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-3 text-[13px] leading-relaxed text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        <span className="font-bold text-ink">[필수]</span>{' '}
        <a href="/terms" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">이용약관</a>
        과{' '}
        <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">개인정보처리방침</a>
        에 동의합니다.
        <span className="mt-1 block text-[11.5px] text-gray-500">
          욕설·비방·음란물 같은 부적절한 게시물과 이를 올린 회원은 경고 없이 삭제되거나 이용이 제한될 수 있어요.
        </span>
      </span>
    </label>
  );
}
