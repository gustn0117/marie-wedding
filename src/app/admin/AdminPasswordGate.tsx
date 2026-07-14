'use client';

import { useState } from 'react';
import Logo from '@/shared/components/Logo';
import { apiFetch } from '@/shared/utils/apiFetch';

/**
 * /admin 진입 시 비밀번호 입력 게이트.
 * 통과하면 marie_admin_unlock 쿠키가 24h 동안 유지되고,
 * server layout이 그 쿠키를 보고 children 을 노출함.
 */
export default function AdminPasswordGate() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await apiFetch('/api/admin/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }, 10_000);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: '' }));
        setError(body.error || `잠금 해제 실패 (HTTP ${res.status})`);
        return;
      }
      // 페이지 새로고침 — server layout이 쿠키 보고 children 렌더링
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Logo variant="full" size="md" />
          <span className="text-[11px] font-bold bg-ink text-white px-2 py-0.5 rounded">ADMIN</span>
        </div>

        <h1 className="text-lg font-bold text-ink text-center mb-1">관리자 페이지</h1>
        <p className="text-xs text-gray-500 text-center mb-6">
          접근 비밀번호를 입력해 주세요.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            required
            className="w-full rounded border border-gray-300 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-50"
          >
            {busy ? '확인 중…' : '잠금 해제'}
          </button>
          {error && (
            <p className="rounded bg-state-urgent-bg border border-state-urgent/30 px-3 py-2 text-sm text-state-urgent">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-[11px] text-gray-400 text-center">
          잠금 해제 후 24시간 동안 유지됩니다.
        </p>
      </div>
    </div>
  );
}
