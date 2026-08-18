'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';
import { clearMarieProfileCookie } from '@/shared/utils/cookieHelpers';

const GAINS = [
  { title: '채용 공고 등록', desc: '공고를 올리고 지원자를 받을 수 있어요.' },
  { title: '지원자 관리', desc: '받은 지원을 확인하고 쪽지로 소통할 수 있어요.' },
  { title: '업체 프로필 등재', desc: '인재·업체 프로필 디렉토리에 업체로 노출될 수 있어요.' },
];

const CHANGES = [
  '마이페이지 메뉴가 업체 기준(공고 운영·받은 지원)으로 바뀌어요.',
  '개인 회원 메뉴(이력서 관리 등)는 보이지 않게 돼요. 작성해둔 이력서·지원 내역 데이터는 삭제되지 않아요.',
  '공고를 등록하려면 업체 프로필(회사명·업종·지역·연락처)을 먼저 완성해야 해요.',
];

export default function ConvertToBusinessClient({ nextPath }: { nextPath: string | null }) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConvert = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/profile/convert-to-business', {
        method: 'POST',
        credentials: 'include',
      }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '전환에 실패했습니다.');
      // 헤더·미들웨어가 보는 표시용 쿠키를 비워 다음 요청에서 새 유형으로 다시 채운다.
      clearMarieProfileCookie();
      toast('업체 회원으로 전환되었습니다.', 'success');
      // router.push 는 클라이언트 캐시(쿠키 기반 useAuth 상태)가 남아 이전 유형으로
      // 보이는 화면이 섞일 수 있어 전체 로드로 이동한다.
      window.location.href = nextPath ?? ROUTES.MYPAGE;
    } catch (e) {
      toast(e instanceof Error ? e.message : '전환에 실패했습니다.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="saramin-section p-5 flex items-center gap-3">
        <Link href={ROUTES.MYPAGE} className="p-2 rounded hover:bg-primary-50 transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <p className="text-sm font-bold text-primary">Account Type</p>
          <h1 className="text-2xl font-bold text-gray-900">업체 회원으로 전환</h1>
        </div>
      </div>

      <div className="card p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-ink mb-3">전환하면 할 수 있는 것</h2>
          <ul className="space-y-3">
            {GAINS.map((g) => (
              <li key={g.title} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-ink flex items-center justify-center shrink-0" aria-hidden>
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{g.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{g.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-sm font-bold text-ink mb-3">전환하면 달라지는 것</h2>
          <ul className="space-y-2">
            {CHANGES.map((c) => (
              <li key={c} className="flex items-start gap-2 text-[13px] text-gray-600 leading-relaxed">
                <span className="mt-[7px] w-1 h-1 rounded-full bg-gray-400 shrink-0" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            다시 개인 회원으로 돌아가려면 <Link href={ROUTES.CONTACT} className="underline hover:text-primary">고객센터</Link>에 문의해주세요.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-[13px] text-gray-700 leading-relaxed">
            위 변경 사항을 확인했고, 업체 회원으로 전환하는 데 동의합니다.
          </span>
        </label>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleConvert}
            disabled={!agreed || submitting}
            className="block w-full h-12 rounded-lg bg-ink text-white text-sm font-bold hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? '전환 중…' : '업체 회원으로 전환하기'}
          </button>
          <Link
            href={ROUTES.MYPAGE}
            className="block w-full text-center text-[12.5px] text-gray-500 hover:text-ink py-2 transition-colors"
          >
            다음에 하기
          </Link>
        </div>
      </div>
    </div>
  );
}
