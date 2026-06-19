'use client';

import { useEffect, useState } from 'react';
import { adminService } from '@/features/admin/services/admin-service';
import { formatDate, getRegionLabel, getBusinessTypeLabels } from '@/shared/utils/format';
import type { Profile } from '@/types/database';
import { computeTrustTier, TRUST_TIER_LABELS } from '@/types/database';

type Detail = Awaited<ReturnType<typeof adminService.getUserDetail>>;

interface Props {
  userId: string | null;
  onClose: () => void;
}

/**
 * 어드민용 회원 상세 정보 모달.
 * 프로필 전체 + auth.users(email/phone/identities/last_sign_in) + 활동 카운트를 한 곳에 표시.
 */
export default function UserDetailModal({ userId, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminService
      .getUserDetail(userId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, onClose]);

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="회원 상세 정보"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">회원 상세</p>
            <h2 className="text-lg font-bold text-ink">{detail?.profile.contact_name ?? '회원'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="px-6 py-5 space-y-6">
          {loading && <p className="text-sm text-gray-500">불러오는 중…</p>}
          {error && (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          {detail && <DetailBody d={detail} />}
        </div>
      </div>
    </div>
  );
}

function DetailBody({ d }: { d: Detail }) {
  const p = d.profile;
  const tier = computeTrustTier(p);
  return (
    <>
      <Section title="기본 정보">
        <Field label="이름">{p.contact_name}</Field>
        <Field label="회사명">{p.company_name || '-'}</Field>
        <Field label="이메일">{d.auth?.email || '-'}</Field>
        <Field label="휴대폰">{p.phone || d.auth?.phone || '-'}</Field>
        <Field label="계정 유형">
          <Badge tone={p.account_type === 'business' ? 'primary' : 'gray'}>
            {p.account_type === 'business' ? '업체' : p.account_type === 'individual' ? '개인' : '미선택'}
          </Badge>
        </Field>
        <Field label="역할">
          <Badge tone={p.role === 'admin' ? 'red' : 'gray'}>{p.role === 'admin' ? '관리자' : '일반'}</Badge>
        </Field>
        <Field label="가입 경로">{providerLabel(p.signup_provider)}</Field>
        <Field label="가입일">{formatDate(p.created_at)}</Field>
        <Field label="온보딩 완료">{p.onboarded_at ? formatDate(p.onboarded_at) : '미완료'}</Field>
        <Field label="마지막 로그인">{d.auth?.last_sign_in_at ? formatDate(d.auth.last_sign_in_at) : '-'}</Field>
      </Section>

      <Section title="프로필">
        <Field label="소개" wide>
          {p.bio ? <p className="whitespace-pre-wrap text-sm text-gray-700">{stripHtml(p.bio)}</p> : <span className="text-gray-400">-</span>}
        </Field>
        <Field label="웹사이트">
          {p.website ? (
            <a href={p.website} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {p.website}
            </a>
          ) : '-'}
        </Field>
        <Field label="프로필 이미지">{p.profile_image || '-'}</Field>
        <Field label="공개 디렉토리 등록">{p.is_directory_listed ? '공개' : '비공개'}</Field>
      </Section>

      <Section title="비즈니스">
        <Field label="업종">{getBusinessTypeLabels(p.business_type).join(', ') || '-'}</Field>
        <Field label="활동 지역">{getRegionLabel(p.region) || '-'}</Field>
        <Field label="회사 규모">{p.company_size || '-'}</Field>
        <Field label="설립 연도">{p.established_year || '-'}</Field>
        <Field label="주소" wide>{p.address || '-'}</Field>
        <Field label="갤러리 수">{(p.gallery?.length ?? 0)}장</Field>
      </Section>

      <Section title="신뢰·인증">
        <Field label="신뢰 등급"><Badge tone="primary">{TRUST_TIER_LABELS[tier]}</Badge></Field>
        <Field label="사업자 인증">
          <Badge tone={p.verification_status === 'verified' ? 'green' : p.verification_status === 'pending' ? 'amber' : 'gray'}>
            {verificationLabel(p.verification_status)}
          </Badge>
        </Field>
        <Field label="사업자 번호">{p.business_number || '-'}</Field>
        <Field label="휴대폰 인증">{p.phone_verified ? `완료 (${p.phone_verified_at ? formatDate(p.phone_verified_at) : ''})` : '미인증'}</Field>
        <Field label="이메일 인증">{d.auth?.email_confirmed_at ? `완료 (${formatDate(d.auth.email_confirmed_at)})` : '미인증'}</Field>
        <Field label="인증 서류">{p.verification_document || '-'}</Field>
        <Field label="인증 거부 사유" wide>{p.verification_reject_reason || '-'}</Field>
      </Section>

      <Section title="활동 통계">
        <Field label="응답률">{Number.isFinite(p.response_rate) ? `${(p.response_rate * 100).toFixed(0)}%` : '-'}</Field>
        <Field label="평균 응답 시간">{p.avg_response_minutes != null ? `${p.avg_response_minutes}분` : '-'}</Field>
        <Field label="완료 거래">{p.completed_deals_count}건</Field>
        <Field label="등록 공고">{d.activity.jobs}건</Field>
        <Field label="작성 글">{d.activity.posts}건</Field>
        <Field label="작성 댓글">{d.activity.comments}건</Field>
        <Field label="보낸 지원">{d.activity.applications_sent}건</Field>
        <Field label="받은 지원">{d.activity.applications_received}건</Field>
      </Section>

      <Section title="결제">
        <Field label="프리미엄 등급"><Badge tone={p.premium_tier === 'free' ? 'gray' : 'primary'}>{p.premium_tier}</Badge></Field>
        <Field label="프리미엄 만료일">{p.premium_until ? formatDate(p.premium_until) : '-'}</Field>
      </Section>

      <Section title="제재·관리">
        <Field label="제재 상태">
          {p.banned_at ? (
            <Badge tone="red">제재됨 ({formatDate(p.banned_at)})</Badge>
          ) : (
            <Badge tone="green">정상</Badge>
          )}
        </Field>
        <Field label="제재 사유" wide>{p.banned_reason || '-'}</Field>
        <Field label="삭제 상태">
          {p.deleted_at ? <Badge tone="red">삭제됨 ({formatDate(p.deleted_at)})</Badge> : '활성'}
        </Field>
        <Field label="관리자 메모" wide>
          {p.admin_note ? <p className="whitespace-pre-wrap text-sm text-gray-700">{p.admin_note}</p> : <span className="text-gray-400">-</span>}
        </Field>
      </Section>

      <Section title="연결된 소셜 계정 + 식별자">
        <Field label="signup_provider">{providerLabel(p.signup_provider)}</Field>
        <Field label="naver_sub">{p.naver_sub || '-'}</Field>
        <Field label="user_id"><code className="text-xs text-gray-600">{p.user_id}</code></Field>
        <Field label="profile_id"><code className="text-xs text-gray-600">{p.id}</code></Field>
        {d.auth && d.auth.identities.length > 0 && (
          <Field label="auth.identities" wide>
            <ul className="space-y-1">
              {d.auth.identities.map((i, idx) => (
                <li key={idx} className="text-sm text-gray-700">
                  <span className="font-semibold">{providerLabel(i.provider)}</span>
                  {i.last_sign_in_at && <span className="ml-2 text-gray-500">최근 {formatDate(i.last_sign_in_at)}</span>}
                </li>
              ))}
            </ul>
          </Field>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border border-gray-100 rounded-lg p-4 bg-gray-50">
        {children}
      </dl>
    </section>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] font-semibold text-gray-500">{label}</dt>
      <dd className="text-sm text-ink break-words">{children ?? '-'}</dd>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'gray' | 'primary' | 'red' | 'green' | 'amber'; children: React.ReactNode }) {
  const cls =
    tone === 'primary'
      ? 'bg-primary-50 text-primary-600'
      : tone === 'red'
        ? 'bg-rose-50 text-rose-600'
        : tone === 'green'
          ? 'bg-emerald-50 text-emerald-700'
          : tone === 'amber'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-gray-100 text-gray-600';
  return <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{children}</span>;
}

function providerLabel(p: string | null | undefined): string {
  if (!p) return '미상';
  return p === 'email' ? '이메일' : p === 'kakao' ? '카카오' : p === 'google' ? 'Google' : p === 'naver' ? '네이버' : p === 'apple' ? 'Apple' : p;
}

function verificationLabel(s: Profile['verification_status']): string {
  return s === 'verified' ? '인증 완료' : s === 'pending' ? '심사 중' : s === 'rejected' ? '거절' : '미인증';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
