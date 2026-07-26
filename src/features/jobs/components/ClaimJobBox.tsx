'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/shared/utils/apiFetch';
import { toast } from '@/shared/components/Toast';

/**
 * 대행 등록된 공고 가져오기 — 업체 회원이 마리에로부터 받은 코드를 입력해
 * 자기 계정으로 공고를 옮긴다. 코드를 넣기 전까지 그 공고는 지원을 받지 않는다.
 */
export default function ClaimJobBox() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) { toast('코드를 입력해주세요.', 'error'); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/api/jobs/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ code: trimmed }),
      }, 15000);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || '가져오기에 실패했습니다.');
      toast(`'${b.title}' 공고를 가져왔습니다.`, 'success');
      setCode('');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '가져오기에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-bold text-ink">마리에가 대신 올린 공고 가져오기</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        마리에에서 공고를 대신 등록해 드린 경우, 전달받은 8자리 코드를 넣으면 이 계정으로 옮겨집니다.
        옮긴 뒤부터 지원자를 받고 공고를 수정하실 수 있습니다.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="예) ABCD-2345"
          maxLength={20}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm tracking-wider focus:border-primary focus:outline-none"
        />
        <button type="button" onClick={submit} disabled={loading} className="btn-primary shrink-0 text-sm disabled:opacity-50">
          {loading ? '확인 중…' : '가져오기'}
        </button>
      </div>
    </section>
  );
}
