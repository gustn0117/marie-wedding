'use client';

import { useState } from 'react';
import { toast } from '@/shared/components/Toast';
import { apiFetch } from '@/shared/utils/apiFetch';

type Target = 'all' | 'business' | 'individual';

export default function AdminBroadcastPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    confirmedFailed: number;
    uncertain: number;
    total: number;
  } | null>(null);

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      toast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    if (!confirm(`${target === 'all' ? '전체' : target === 'business' ? '업체' : '개인'} 회원에게 공지 메일을 발송할까요?`)) return;
    setSending(true);
    setResult(null);
    const campaignId = crypto.randomUUID();
    try {
      for (;;) {
        const res = await apiFetch('/api/admin/broadcast', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, subject, message, target }),
        }, 55_000);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || '발송에 실패했습니다.');
        const uncertain = body.uncertain ?? 0;
        const confirmedFailed = body.confirmedFailed ?? Math.max(0, (body.failed ?? 0) - uncertain);
        setResult({ sent: body.sent ?? 0, confirmedFailed, uncertain, total: body.total ?? 0 });
        if (body.done) {
          const failed = confirmedFailed + uncertain;
          toast(failed > 0
            ? `${body.sent}/${body.total}명 발송 · 실패 ${confirmedFailed}명 · 결과 불명 ${uncertain}명`
            : `${body.sent}/${body.total}명에게 발송했습니다.`, failed > 0 ? 'error' : 'success');
          break;
        }
        if ((body.retryAfterMs ?? 0) > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(body.retryAfterMs, 5_000)));
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '발송에 실패했습니다.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">공지 메일 발송</h1>
        <p className="mt-1 text-sm text-gray-500">회원에게 안내 이메일을 일괄 발송합니다. 운영 메일 제공자가 없으면 발송하지 않고 실패로 기록합니다.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-800">받는 대상</label>
          <div className="flex gap-2">
            {([['all', '전체'], ['business', '업체'], ['individual', '개인']] as [Target, string][]).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(v)}
                className={`px-4 py-2 rounded text-sm font-bold border transition-colors ${
                  target === v ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="b-subject" className="block text-sm font-semibold text-gray-800">제목</label>
          <input id="b-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder="공지 제목" maxLength={120} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="b-message" className="block text-sm font-semibold text-gray-800">내용</label>
          <textarea id="b-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={10} className="w-full rounded border border-gray-300 px-4 py-3 text-sm resize-y focus:outline-none focus:border-primary" placeholder="공지 내용을 입력하세요. 줄바꿈은 그대로 유지됩니다." maxLength={5000} />
          <p className="text-right text-xs text-gray-400">{message.length}/5000</p>
        </div>

        {result && (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            발송 결과: 성공 {result.sent}/{result.total}명
            {result.confirmedFailed > 0 ? ` · 실패 ${result.confirmedFailed}명` : ''}
            {result.uncertain > 0 ? ` · 결과 불명 ${result.uncertain}명(중복 방지를 위해 재발송 안 함)` : ''}
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={send} disabled={sending} className="rounded bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
            {sending ? '발송 중...' : '발송하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
