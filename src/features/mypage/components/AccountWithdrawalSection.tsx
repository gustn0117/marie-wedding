'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';
import { ROUTES } from '@/shared/constants';

const CONFIRM_PHRASE = '회원탈퇴 동의';

/**
 * 자기 자신의 계정을 soft delete 처리하는 섹션.
 *
 * RPC marie_wedding.cancel_my_account()를 호출:
 *  - profiles.deleted_at = NOW(), is_directory_listed = false
 *  - 작성한 jobs/posts/comments도 함께 soft delete
 *  - auth.users는 그대로 남음 (관리자가 admin 패널에서 purge 가능)
 *
 * RPC 성공 후 클라이언트 측 supabase signOut + cookie clear + 홈으로 이동.
 */
export default function AccountWithdrawalSection() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = phrase.trim() === CONFIRM_PHRASE;

  const handleWithdraw = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const sb = createClient();
      const { error } = await withTimeout(sb.rpc('cancel_my_account'), 15000);
      if (error) throw error;

      // 클라이언트 측 정리 즉시
      document.cookie = 'marie_profile=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      try {
        await withTimeout(sb.auth.signOut(), 3000);
      } catch {
        // 무시 — RPC는 이미 성공
      }

      toast('회원 탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.', 'success');
      window.location.href = ROUTES.HOME;
    } catch (err) {
      console.error('[AccountWithdrawal] failed:', err);
      toast(err instanceof Error ? err.message : '탈퇴 처리에 실패했습니다.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-6 md:p-8">
      <header className="mb-3">
        <h2 className="text-base font-bold text-ink">회원 탈퇴</h2>
        <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">
          탈퇴하면 프로필과 작성한 공고·게시글·댓글이 모두 비공개로 전환됩니다.
          다시 가입하면 새 계정으로 시작하게 됩니다.
        </p>
      </header>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-200 bg-white text-[12.5px] font-semibold text-gray-600 hover:border-rose-300 hover:text-rose-600 transition-colors"
        >
          회원 탈퇴 진행
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4">
          <ul className="text-[12px] text-gray-700 list-disc pl-5 space-y-1">
            <li>등록한 채용 공고와 작성한 게시글이 모두 비공개 처리됩니다.</li>
            <li>지원 내역, 받은 지원, 스크랩, 쪽지 등은 시스템에 남아 상대방에게 노출될 수 있습니다.</li>
            <li>탈퇴 후 동일 이메일로 다시 가입하려면 운영팀 문의가 필요할 수 있습니다.</li>
          </ul>

          <div>
            <label htmlFor="withdraw-confirm" className="block text-[12px] font-semibold text-ink mb-1">
              계속하려면 아래 입력란에 <span className="font-bold text-rose-600">{CONFIRM_PHRASE}</span> 라고 입력해주세요.
            </label>
            <input
              id="withdraw-confirm"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="w-full h-10 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:border-rose-400"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setPhrase(''); }}
              disabled={submitting}
              className="px-4 h-9 rounded-lg border border-gray-300 bg-white text-[12.5px] font-semibold text-gray-700 hover:border-gray-400"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={!canSubmit || submitting}
              className="px-4 h-9 rounded-lg bg-rose-600 text-white text-[12.5px] font-bold hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? '처리 중…' : '탈퇴 진행'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
