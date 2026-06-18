'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/shared/components/Toast';

type ProviderKey = 'kakao' | 'google' | 'apple' | 'naver';

interface IdentityRow {
  provider: ProviderKey | 'email';
  last_sign_in_at: string | null;
  identity_id?: string;
}

/**
 * 마이페이지 > 연결된 계정 섹션.
 *
 * 보안 가드:
 *  - link: supabase.auth.linkIdentity() 호출. Supabase가 자체 PKCE/state 처리.
 *  - unlink: 마지막 인증 수단이 사라지지 않도록 가드.
 *
 * 네이버는 자체 OAuth라 Supabase identities에 잡히지 않음 — profiles.signup_provider='naver'로 별도 표시.
 */
export default function ConnectedAccountsSection() {
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [naverConnected, setNaverConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<ProviderKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }
      const rows: IdentityRow[] = (user.identities ?? []).map((i) => ({
        provider: (i.provider as IdentityRow['provider']) || 'email',
        last_sign_in_at: i.last_sign_in_at ?? null,
        identity_id: i.identity_id ?? undefined,
      }));
      setIdentities(rows);
      // 네이버 연결 여부: profiles.signup_provider 또는 user_metadata.provider
      const provider = (user.app_metadata?.provider as string | undefined)
        || (user.user_metadata?.provider as string | undefined);
      if (provider === 'naver' || user.user_metadata?.naver_id) {
        setNaverConnected(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasEmailIdentity = identities.some((i) => i.provider === 'email');
  const totalAuthMethods = identities.length + (naverConnected && !identities.some(i => i.provider === 'naver') ? 1 : 0);

  const connect = async (provider: ProviderKey) => {
    setActing(provider);
    try {
      if (provider === 'naver') {
        window.location.href = '/auth/naver/start?next=/mypage/edit';
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/mypage/edit`,
        },
      });
      if (error) throw error;
    } catch (err) {
      toast(err instanceof Error ? err.message : '연결에 실패했습니다.', 'error');
      setActing(null);
    }
  };

  const disconnect = async (row: IdentityRow) => {
    if (!row.identity_id) return;
    // 마지막 인증 수단 보호
    if (totalAuthMethods <= 1) {
      toast('마지막 로그인 방법은 해제할 수 없어요. 다른 방법을 먼저 연결해주세요.', 'error');
      return;
    }
    if (!window.confirm(`${labelOf(row.provider as ProviderKey)} 연결을 해제하시겠어요?`)) {
      return;
    }
    setActing(row.provider as ProviderKey);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.unlinkIdentity({
        identity_id: row.identity_id,
        provider: row.provider,
        user_id: '',
        id: row.identity_id,
        identity_data: {},
        last_sign_in_at: row.last_sign_in_at ?? '',
        created_at: '',
        updated_at: '',
      });
      if (error) throw error;
      setIdentities((prev) => prev.filter((i) => i.identity_id !== row.identity_id));
      toast('연결을 해제했어요.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '해제에 실패했습니다.', 'error');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return null;
  }

  const providerStatus = (key: ProviderKey): { connected: boolean; row?: IdentityRow } => {
    if (key === 'naver') {
      return { connected: naverConnected };
    }
    const row = identities.find((i) => i.provider === key);
    return { connected: !!row, row };
  };

  return (
    <section className="bg-white rounded border border-gray-200 p-6 md:p-8">
      <header className="mb-4">
        <h2 className="text-base font-bold text-ink">연결된 계정</h2>
        <p className="mt-1 text-xs text-gray-500">
          소셜 계정을 연결하면 다음부터 더 빠르게 로그인할 수 있어요. 기존 이메일 로그인도 그대로 유지됩니다.
        </p>
      </header>

      <ul className="divide-y divide-gray-100">
        {(['kakao', 'naver', 'google', 'apple'] as ProviderKey[]).map((p) => {
          const { connected, row } = providerStatus(p);
          return (
            <li key={p} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <ProviderBadge p={p} />
                <div>
                  <p className="text-sm font-semibold text-ink">{labelOf(p)}</p>
                  <p className="text-[11px] text-gray-500">
                    {connected
                      ? (row?.last_sign_in_at
                          ? `연결됨 · 마지막 사용 ${formatDate(row.last_sign_in_at)}`
                          : '연결됨')
                      : '미연결'}
                  </p>
                </div>
              </div>
              {connected ? (
                row?.identity_id ? (
                  <button
                    type="button"
                    onClick={() => disconnect(row)}
                    disabled={acting === p}
                    className="text-xs font-semibold text-gray-500 hover:text-rose-600 px-2 py-1"
                  >
                    {acting === p ? '처리 중…' : '해제'}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-gray-400">연결됨</span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => connect(p)}
                  disabled={acting === p}
                  className="text-xs font-semibold text-primary hover:text-primary-dark px-2 py-1"
                >
                  {acting === p ? '연결 중…' : '연결하기'}
                </button>
              )}
            </li>
          );
        })}
        {hasEmailIdentity && (
          <li className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">이메일 / 비밀번호</p>
                <p className="text-[11px] text-gray-500">사용 중</p>
              </div>
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}

function labelOf(p: ProviderKey): string {
  return p === 'kakao' ? '카카오' : p === 'naver' ? '네이버' : p === 'google' ? 'Google' : 'Apple';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return '';
  }
}

function ProviderBadge({ p }: { p: ProviderKey }) {
  const bg = p === 'kakao' ? 'bg-[#FEE500]' : p === 'naver' ? 'bg-[#03C75A]' : p === 'google' ? 'bg-white border border-gray-300' : 'bg-black';
  return (
    <div className={`w-8 h-8 rounded ${bg} flex items-center justify-center`}>
      <span className={`text-[11px] font-bold ${p === 'apple' || p === 'naver' ? 'text-white' : p === 'kakao' ? 'text-[#3C1E1E]' : 'text-gray-700'}`}>
        {p === 'kakao' ? 'K' : p === 'naver' ? 'N' : p === 'google' ? 'G' : 'A'}
      </span>
    </div>
  );
}
