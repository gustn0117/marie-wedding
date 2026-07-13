'use client';

import { useState } from 'react';
import { toast } from '@/shared/components/Toast';

export default function SupportInquiryForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { toast('문의 내용을 입력해주세요.', 'error'); return; }
    if (!phone.trim() && !email.trim()) { toast('연락받을 전화번호나 이메일 중 하나는 입력해주세요.', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: '' }));
        throw new Error(b.error || '문의 접수에 실패했습니다.');
      }
      setDone(true);
      setName(''); setPhone(''); setEmail(''); setMessage('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '문의 접수에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card p-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-text-primary">문의가 접수되었습니다</h3>
        <p className="text-sm text-gray-500">남겨주신 연락처로 담당자가 확인 후 연락드리겠습니다.</p>
        <button type="button" onClick={() => setDone(false)} className="btn-outline text-sm inline-flex mt-1">
          추가 문의하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 md:p-8 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">문의하기</h2>
        <p className="mt-1 text-sm text-gray-500">궁금하신 점을 남겨주시면 확인 후 연락드리겠습니다.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="s-name" className="block text-sm font-medium text-text-primary">이름 <span className="text-xs font-normal text-gray-400">(선택)</span></label>
        <input id="s-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field w-full" placeholder="성함을 입력해주세요" maxLength={100} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="s-phone" className="block text-sm font-medium text-text-primary">전화번호</label>
          <input id="s-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field w-full" placeholder="010-0000-0000" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="s-email" className="block text-sm font-medium text-text-primary">이메일</label>
          <input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full" placeholder="you@example.com" maxLength={200} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-400">전화번호와 이메일 중 <b>하나 이상</b> 입력해주세요. 답변을 이 연락처로 드립니다.</p>

      <div className="space-y-1.5">
        <label htmlFor="s-message" className="block text-sm font-medium text-text-primary">문의 내용 <span className="text-state-urgent">*</span></label>
        <textarea id="s-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="input-field w-full resize-y" placeholder="문의하실 내용을 자세히 적어주세요." maxLength={5000} />
        <p className="text-right text-xs text-gray-400">{message.length}/5000</p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? '접수 중...' : '문의 접수'}
        </button>
      </div>
    </form>
  );
}
