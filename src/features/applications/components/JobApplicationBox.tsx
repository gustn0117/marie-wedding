'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import type { Application, ApplicationStatus, Profile } from '@/types/database';
import {
  APPLICATION_STATUS_LABELS,
  applicationService,
  type HiringApplicationPage,
} from '@/features/applications/services/application-service';
import { formatRelativeTime, getPrimaryBusinessTypeLabel, getRegionLabel, formatPhone } from '@/shared/utils/format';
import { withTimeout } from '@/shared/utils/withTimeout';
import ProfileAvatar from '@/shared/components/ProfileAvatar';
import { toast, toastConfirm } from '@/shared/components/Toast';
import { computeTrustTier, TRUST_TIER_LABELS } from '@/types/database';
import { apiFetch } from '@/shared/utils/apiFetch';
import {
  isResumeContentSubmittable,
  isValidResumePhone,
  type ResumeRecord,
} from '@/features/resumes/types';
import { isUuid } from '@/shared/utils/uuid';
import { resolveResumePhotoUrl } from '@/features/resumes/lib/photo';

interface JobApplicationBoxProps {
  jobId: string;
  authorId: string;
  /** 공고가 마감(마감일 경과 또는 status closed/filled/hidden)되면 지원 폼 대신 마감 안내를 노출. */
  isClosed?: boolean;
}

const NEXT_STATUSES: ApplicationStatus[] = ['reviewing', 'accepted', 'rejected'];
const APPLICATION_FILTERS: Array<ApplicationStatus | 'all'> = ['all', 'pending', 'reviewing', 'accepted', 'rejected', 'cancelled'];
const MAX_APPLICATION_MESSAGE_LENGTH = 5_000;

const FILTER_LABELS: Record<ApplicationStatus | 'all', string> = {
  all: '전체',
  pending: '접수',
  reviewing: '검토 중',
  accepted: '승인',
  rejected: '거절',
  cancelled: '취소',
};

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function JobApplicationBox({ jobId, authorId, isClosed = false }: JobApplicationBoxProps) {
  const { profile, isLoading } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [received, setReceived] = useState<Application[]>([]);
  const [receivedError, setReceivedError] = useState('');
  const [receivedReloadKey, setReceivedReloadKey] = useState(0);
  const [message, setMessage] = useState('');
  const [careerSummary, setCareerSummary] = useState('');
  const [availableSchedule, setAvailableSchedule] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mutatingApplicationIds, setMutatingApplicationIds] = useState<Set<string>>(() => new Set());
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [resumesLoading, setResumesLoading] = useState(true);
  const [resumesError, setResumesError] = useState('');
  const [resumeReloadKey, setResumeReloadKey] = useState(0);
  const [draftHydratedKey, setDraftHydratedKey] = useState('');
  // 프로필 값 프리필을 최초 1회로 제한 (토큰 갱신 시 profile 재생성으로 인한 입력값 덮어쓰기 방지)
  const prefilledRef = useRef(false);
  const applicationIdRef = useRef<string | null>(null);
  const mutationSequenceRef = useRef(new Map<string, number>());
  const searchParams = useSearchParams();

  const isAuthor = !!profile && profile.id === authorId;
  const profileId = profile?.id;
  const profileBio = profile?.bio;
  const profileAccountType = profile?.account_type;
  const actionLabel = '지원';
  const requestedResumeId = searchParams.get('resumeId');
  const safeRequestedResumeId = requestedResumeId && isUuid(requestedResumeId) ? requestedResumeId : '';
  const returnToApplication = selectedResumeId
    ? `/jobs/${jobId}?resumeId=${encodeURIComponent(selectedResumeId)}#apply`
    : `/jobs/${jobId}#apply`;
  const resumeManagerHref = `${ROUTES.MYPAGE_RESUMES}?next=${encodeURIComponent(returnToApplication)}${selectedResumeId ? `&resumeId=${encodeURIComponent(selectedResumeId)}` : ''}`;
  const applicationDraftKey = profileId && profileId !== authorId
    ? `marie:application-draft:${profileId}:${jobId}`
    : '';

  useEffect(() => {
    if (isLoading) return;
    if (!profileId) {
      setLoading(false);
      return;
    }
    let active = true;

    // 본인이 작성자가 아니면 폼을 즉시 노출하고, 기존 지원 내역 체크는 백그라운드로 수행.
    // (체크 결과가 오기 전에도 사용자는 폼을 보고 입력 시작 가능)
    if (profileId !== authorId) {
      // 폼 즉시 노출 — 스켈레톤 없음
      setLoading(false);
      // 프로필 값으로 최초 1회만 프리필. 토큰 갱신으로 effect가 재실행돼도
      // 사용자가 입력하거나 지운 값(연락처·경력)을 덮어쓰지 않는다.
      if (!prefilledRef.current) {
        prefilledRef.current = true;
        setCareerSummary(stripHtml(profileBio ?? '').slice(0, 180));
      }

      // 백그라운드: 이미 지원했는지 체크. 결과 오면 상태 전환, 실패해도 폼 그대로 유지.
      withTimeout(
        applicationService.getApplicationForJob(jobId, profileId),
        4000,
        '지원 내역 조회 지연',
      )
        .then((row) => {
          if (active && row) {
            setApplication(row);
            if (applicationDraftKey) sessionStorage.removeItem(applicationDraftKey);
          }
        })
        .catch(() => {});
      return () => { active = false; };
    }

    // 작성자(업체) 측 — 지원자 파이프라인 조회는 데이터가 핵심이므로 스켈레톤 표시.
    setLoading(true);
    setReceivedError('');
    // 이 공고의 지원서만 서버에서 필터링 조회 (전체 지원서 무제한 fetch + 클라 필터 제거).
    setReceived([]);
    void (async () => {
      let cursor: string | null = null;
      let firstPage = true;
      do {
        const page: HiringApplicationPage = await withTimeout(
          applicationService.getApplicationsForJob(jobId, cursor),
          8_000,
          '지원자 목록 조회 지연',
        );
        if (!active) return;
        if (firstPage) {
          setReceived(page.applications);
          setLoading(false);
          firstPage = false;
        } else {
          setReceived((current) => {
            const known = new Set(current.map((item) => item.id));
            return [...current, ...page.applications.filter((item) => !known.has(item.id))];
          });
        }
        const previousCursor: string | null = cursor;
        cursor = page.nextCursor;
        if (cursor && cursor === previousCursor) throw new Error('지원자 페이지 정보가 반복되었습니다.');
      } while (cursor);
    })()
      .catch((error) => {
        if (active) setReceivedError(error instanceof Error ? error.message : '지원자 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [applicationDraftKey, authorId, isLoading, jobId, profileBio, profileId, receivedReloadKey]);

  useEffect(() => {
    if (!applicationDraftKey) {
      setDraftHydratedKey('');
      return;
    }
    try {
      const raw = sessionStorage.getItem(applicationDraftKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (typeof saved.message === 'string') setMessage(saved.message.slice(0, 4_000));
        if (typeof saved.careerSummary === 'string') setCareerSummary(saved.careerSummary.slice(0, 500));
        if (typeof saved.availableSchedule === 'string') setAvailableSchedule(saved.availableSchedule.slice(0, 300));
        if (typeof saved.contactPhone === 'string') setContactPhone(saved.contactPhone.slice(0, 40));
        if (typeof saved.selectedResumeId === 'string' && isUuid(saved.selectedResumeId)) {
          setSelectedResumeId(saved.selectedResumeId);
        }
      }
    } catch {
      sessionStorage.removeItem(applicationDraftKey);
    } finally {
      setDraftHydratedKey(applicationDraftKey);
    }
  }, [applicationDraftKey]);

  useEffect(() => {
    if (!applicationDraftKey || draftHydratedKey !== applicationDraftKey || application) return;
    sessionStorage.setItem(applicationDraftKey, JSON.stringify({
      message,
      careerSummary,
      availableSchedule,
      contactPhone,
      selectedResumeId,
    }));
  }, [application, applicationDraftKey, availableSchedule, careerSummary, contactPhone, draftHydratedKey, message, selectedResumeId]);

  useEffect(() => {
    if (isLoading) return;
    if (!profileId || profileAccountType !== 'individual' || profileId === authorId) {
      setResumes([]);
      setSelectedResumeId('');
      setResumesLoading(false);
      setResumesError('');
      return;
    }

    let active = true;
    const controller = new AbortController();
    setResumesLoading(true);
    setResumesError('');

    apiFetch('/api/resumes', {
      credentials: 'include',
      signal: controller.signal,
    }, 8_000)
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { resumes?: ResumeRecord[]; error?: string };
        if (!response.ok) throw new Error(body.error || '이력서를 불러오지 못했습니다.');
        if (!active) return;
        const nextResumes = Array.isArray(body.resumes) ? body.resumes : [];
        setResumes(nextResumes);
        setSelectedResumeId((current) => {
          const requested = nextResumes.find((resume) => resume.id === safeRequestedResumeId);
          if (requested) return requested.id;
          if (nextResumes.some((resume) => resume.id === current)) return current;
          return (
            nextResumes.find((resume) => resume.isDefault)
            ?? nextResumes[0]
          )?.id ?? '';
        });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setResumes([]);
        setSelectedResumeId('');
        setResumesError(error instanceof Error ? error.message : '이력서를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setResumesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [authorId, isLoading, profileAccountType, profileId, resumeReloadKey, safeRequestedResumeId]);

  const pendingCount = useMemo(
    () => received.filter((item) => item.status === 'pending' || item.status === 'reviewing').length,
    [received],
  );
  const pipelineCounts = useMemo(() => {
    const counts = APPLICATION_FILTERS.reduce(
      (acc, status) => ({ ...acc, [status]: status === 'all' ? received.length : received.filter((item) => item.status === status).length }),
      {} as Record<ApplicationStatus | 'all', number>,
    );
    return counts;
  }, [received]);
  const filteredReceived = useMemo(
    () => statusFilter === 'all' ? received : received.filter((item) => item.status === statusFilter),
    [received, statusFilter],
  );
  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId],
  );
  const resumeReady = !!selectedResume
    && isResumeContentSubmittable(selectedResume, selectedResume.completenessScore);
  const composedMessage = useMemo(() => {
    if (!profile) return '';
    const name = profile.company_name || profile.contact_name || '지원자';
    const field = getPrimaryBusinessTypeLabel(profile.business_type, 2) || '미입력';
    const region = getRegionLabel(profile.region) || '미입력';
    return [
      '[지원 요약]',
      `- 이름/프로필: ${name}`,
      `- 활동 분야: ${field}`,
      `- 활동 지역: ${region}`,
      `- 경력/강점: ${careerSummary.trim() || '미입력'}`,
      `- 가능 일정: ${availableSchedule.trim() || '미입력'}`,
      '',
      '[지원 쪽지]',
      message.trim(),
    ].join('\n');
  }, [availableSchedule, careerSummary, message, profile]);
  // 직접 입력 → 선택한 이력서 → 프로필 순으로 실제 제출 연락처를 결정한다.
  const effectiveContactPhone = contactPhone.trim()
    || selectedResume?.phone.trim()
    || (profile?.phone ?? '').trim();
  const phoneAvailable = isValidResumePhone(effectiveContactPhone);

  const beginApplicationMutation = (id: string) => {
    const sequence = (mutationSequenceRef.current.get(id) ?? 0) + 1;
    mutationSequenceRef.current.set(id, sequence);
    setMutatingApplicationIds((current) => new Set(current).add(id));
    return sequence;
  };

  const finishApplicationMutation = (id: string, sequence: number) => {
    if (mutationSequenceRef.current.get(id) !== sequence) return;
    setMutatingApplicationIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const submit = async () => {
    if (!profile) { toast('로그인이 필요합니다.', 'error'); return; }
    if (resumesLoading) { toast('이력서를 불러오고 있습니다.', 'error'); return; }
    if (!selectedResume) { toast('제출할 이력서를 선택해주세요.', 'error'); return; }
    if (!resumeReady) { toast('이력서 완성도를 60% 이상으로 채워주세요.', 'error'); return; }
    if (message.trim().length < 10) { toast('지원 쪽지를 10자 이상 입력해주세요.', 'error'); return; }
    if (composedMessage.length > MAX_APPLICATION_MESSAGE_LENGTH) { toast('지원 내용을 조금 줄여주세요.', 'error'); return; }
    if (!phoneAvailable) { toast('연락받을 휴대폰 번호를 입력해주세요.', 'error'); return; }
    setSubmitting(true);
    try {
      const applicationId = applicationIdRef.current ?? crypto.randomUUID();
      applicationIdRef.current = applicationId;
      const created = await withTimeout(
        applicationService.createApplication({
          applicationId,
          jobId,
          resumeId: selectedResume.id,
          message: composedMessage,
          contactPhone: effectiveContactPhone,
        }),
        10000,
      );
      setApplication(created);
      setMessage('');
      setCareerSummary('');
      setAvailableSchedule('');
      if (applicationDraftKey) sessionStorage.removeItem(applicationDraftKey);
      // 채용자에게 새 지원자 알림 이메일 — best-effort (실패해도 지원 접수엔 영향 없음)
      void apiFetch('/api/notify/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: created.id }),
      }, 10_000).catch(() => {});
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      if (rawMessage.includes('이미 접수') || rawMessage.includes('duplicate')) {
        try {
          const existing = await applicationService.getApplicationForJob(jobId, profile.id);
          if (existing) {
            setApplication(existing);
            toast('이미 접수된 지원 내역을 불러왔습니다.', 'success');
            return;
          }
        } catch {
          // 아래의 명확한 중복 안내를 유지한다.
        }
      }
      const msg = rawMessage.includes('이미 접수') || rawMessage.includes('duplicate')
        ? '이미 접수된 내역이 있습니다.'
        : rawMessage.includes('초과')
          ? '접수 요청이 너무 오래 걸려요. 접수 내역을 확인해주세요.'
          : rawMessage || '접수에 실패했습니다.';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    const sequence = beginApplicationMutation(id);
    try {
      const updated = await withTimeout(applicationService.updateStatus(id, status, 'hiring'), 10000, '상태 변경 지연');
      if (mutationSequenceRef.current.get(id) === sequence) {
        // 상태 응답과 메모 저장 응답이 엇갈려도 비공개 메모의 최신값은 보존한다.
        setReceived((prev) => prev.map((item) => (item.id === id ? { ...updated, author_note: item.author_note } : item)));
      }
    } catch {
      toast('상태 변경에 실패했습니다.', 'error');
    } finally {
      finishApplicationMutation(id, sequence);
    }
  };

  const markCompleted = async (id: string, target: 'received' | 'applied') => {
    const sequence = beginApplicationMutation(id);
    try {
      const updated = await withTimeout(
        applicationService.markCompleted(id, target === 'received' ? 'hiring' : 'applicant'),
        10000,
        '완료 처리 지연',
      );
      if (mutationSequenceRef.current.get(id) !== sequence) return;
      if (target === 'received') {
        setReceived((prev) => prev.map((item) => (item.id === id ? { ...updated, author_note: item.author_note } : item)));
      } else {
        setApplication(updated);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast(msg.includes('not_accepted') ? '승인된 지원만 완료 처리할 수 있습니다.' : '완료 처리에 실패했습니다.', 'error');
    } finally {
      finishApplicationMutation(id, sequence);
    }
  };

  const cancelMyApplication = async () => {
    if (!application) return;
    const ok = await toastConfirm('지원을 취소하시겠습니까? 취소 후에는 이 공고에 다시 지원할 수 없습니다.');
    if (!ok) return;
    const sequence = beginApplicationMutation(application.id);
    try {
      const updated = await withTimeout(applicationService.updateStatus(application.id, 'cancelled'), 10000, '지원 취소 지연');
      if (mutationSequenceRef.current.get(application.id) === sequence) setApplication(updated);
      toast('지원이 취소되었습니다.', 'success');
    } catch {
      toast('취소에 실패했습니다.', 'error');
    } finally {
      finishApplicationMutation(application.id, sequence);
    }
  };

  if (isLoading || loading) {
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8 animate-pulse">
        <div className="h-5 w-32 bg-gray-100 rounded mb-4" />
        <div className="h-24 bg-gray-100 rounded" />
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{actionLabel}하려면 로그인이 필요합니다</h2>
        <p className="text-sm text-gray-500 mb-4">마리에 프로필로 로그인한 뒤 공고 작성자에게 바로 연락할 수 있습니다.</p>
        <Link href={ROUTES.LOGIN} className="btn-primary inline-flex">로그인하기</Link>
      </section>
    );
  }

  if (isAuthor) {
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">지원자 파이프라인</h2>
            <p className="mt-1 text-sm text-gray-500">총 {received.length}건 · 검토 필요 {pendingCount}건</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {APPLICATION_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded border px-2 py-2 text-left transition-colors ${
                statusFilter === status
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary'
              }`}
            >
              <span className="block text-[11px] font-semibold">{FILTER_LABELS[status]}</span>
              <span className="mt-0.5 block text-lg font-extrabold tabular-nums">{pipelineCounts[status] ?? 0}</span>
            </button>
          ))}
        </div>

        {receivedError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
            <span>{receivedError}</span>
            <button type="button" onClick={() => setReceivedReloadKey((value) => value + 1)} className="font-bold text-primary hover:underline">
              다시 불러오기
            </button>
          </div>
        )}

        {received.length === 0 ? (
          receivedError ? null : (
          <div className="py-8 text-center text-sm text-gray-400">아직 접수된 {actionLabel} 내역이 없습니다.</div>
          )
        ) : filteredReceived.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">선택한 상태의 지원자가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredReceived.map((item) => (
              <article key={item.id} className="py-4">
                <div className="flex items-start gap-3">
                  <ProfileAvatar
                    profileImage={item.applicant?.profile_image}
                    name={item.applicant?.company_name || item.applicant?.contact_name || '?'}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        {item.applicant?.company_name || item.applicant?.contact_name || '알 수 없음'}
                      </h3>
                      {item.applicant && (() => {
                        const tier = computeTrustTier(item.applicant);
                        const emphasis = tier === 'deal_proven' || tier === 'business_verified';
                        return (
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold border ${emphasis ? 'border-primary bg-white text-primary' : 'border-gray-300 bg-white text-gray-600'}`}>
                            {TRUST_TIER_LABELS[tier]}
                          </span>
                        );
                      })()}
                      <span className="badge-attr">{APPLICATION_STATUS_LABELS[item.status]}</span>
                      <span className="text-xs text-gray-400">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    {item.applicant && <ApplicantSnapshot applicant={item.applicant} contactPhone={item.contact_phone} />}
                    {item.contact_phone && <p className="mt-1 text-xs text-gray-500">연락처 {item.contact_phone}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words rounded bg-secondary-50 px-3 py-3 text-sm leading-6 text-gray-700">
                      {item.message}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Link
                        href={`/applications/${item.id}`}
                        className="rounded border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
                      >
                        제출 이력서 보기
                      </Link>
                      {NEXT_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(item.id, status)}
                          disabled={item.status === status || mutatingApplicationIds.has(item.id)}
                          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary disabled:bg-primary disabled:text-white disabled:border-primary"
                        >
                          {APPLICATION_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                    {item.status === 'accepted' && (
                      <ApplicationCompletionRow
                        application={item}
                        side="hiring"
                        disabled={mutatingApplicationIds.has(item.id)}
                        onMark={() => markCompleted(item.id, 'received')}
                      />
                    )}
                    <AuthorNoteEditor
                      application={item}
                      onChange={(updated) => setReceived((prev) => prev.map((x) => (
                        x.id === item.id ? { ...x, author_note: updated.author_note } : x
                      )))}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  // 업체 회원은 본인이 작성자가 아니면 지원 자체가 불가.
  // 단, 과거에 개인 회원으로 지원한 이력이 있으면 그 application은 그대로 보여줌(아래 application 분기로 진행).
  const isBusinessApplicant = profile.account_type === 'business' && !isAuthor;

  if (application) {
    const canCancel = application.status === 'pending' || application.status === 'reviewing';
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">{actionLabel} 접수 완료</h2>
          {canCancel && (
            <button
              type="button"
              onClick={cancelMyApplication}
              disabled={mutatingApplicationIds.has(application.id)}
              className="text-xs text-gray-500 hover:text-state-urgent underline disabled:opacity-50"
            >
              {actionLabel} 취소
            </button>
          )}
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="badge-primary">{APPLICATION_STATUS_LABELS[application.status]}</span>
          <span className="text-gray-400">{formatRelativeTime(application.created_at)} 접수</span>
        </div>
        <p className="whitespace-pre-wrap rounded bg-secondary-50 px-4 py-3 text-sm leading-6 text-gray-700">{application.message}</p>
        <div className="mt-3 flex justify-end">
          <Link href={`/applications/${application.id}`} className="text-sm font-bold text-primary hover:underline">
            제출 이력서 확인 →
          </Link>
        </div>
        {application.status === 'accepted' && (
          <ApplicationCompletionRow
            application={application}
            side="applicant"
            disabled={mutatingApplicationIds.has(application.id)}
            onMark={() => markCompleted(application.id, 'applied')}
          />
        )}
      </section>
    );
  }

  if (isBusinessApplicant) {
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8 text-center">
        <div className="mx-auto mb-3 inline-flex w-12 h-12 items-center justify-center rounded-full bg-gray-100">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">업체 회원은 지원할 수 없어요</h2>
        <p className="text-sm text-gray-500 mb-4">
          지원은 개인 회원만 가능합니다. 업체 회원은 직접 공고를 등록해 지원자를 받을 수 있어요.
        </p>
        <div className="inline-flex items-center gap-2">
          <Link href={ROUTES.JOBS} className="btn-outline">
            다른 공고 보기
          </Link>
          <Link href="/jobs/new" className="btn-primary">
            새 공고 등록
          </Link>
        </div>
      </section>
    );
  }

  // 마감된 공고(마감일 경과 또는 status closed/filled/hidden)에는 지원 폼 대신 마감 안내.
  // isAuthor(파이프라인)·application(기존 지원 상태) 분기는 위에서 이미 처리되어 마감 후에도 유지된다.
  if (isClosed) {
    return (
      <section className="bg-white border-y border-gray-200 p-6 md:p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-1">마감된 공고입니다</h2>
        <p className="text-sm text-gray-500 mb-4">이 공고는 마감되어 더 이상 지원할 수 없습니다.</p>
        <Link href={ROUTES.JOBS} className="btn-outline inline-flex">다른 공고 보기</Link>
      </section>
    );
  }

  return (
    <section className="bg-white border-y border-gray-200 p-6 md:p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{actionLabel}하기</h2>
      <p className="text-sm text-gray-500 mb-4">선택한 이력서는 지원 시점의 내용으로 제출되며, 이후 수정해도 제출본은 바뀌지 않습니다.</p>
      <div className="space-y-3">
        <div className="rounded border border-gray-200 bg-secondary-50 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-gray-800">제출 이력서 <span className="text-rose-500">*</span></p>
            <Link href={resumeManagerHref} className="text-xs font-bold text-primary hover:underline">
              이력서 관리
            </Link>
          </div>

          {resumesLoading ? (
            <div className="space-y-2 animate-pulse" aria-label="이력서를 불러오는 중">
              <div className="h-10 rounded bg-gray-200" />
              <div className="h-4 w-2/3 rounded bg-gray-200" />
            </div>
          ) : resumesError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-rose-200 bg-white px-3 py-2.5">
              <p className="text-xs text-rose-600">{resumesError}</p>
              <button
                type="button"
                onClick={() => setResumeReloadKey((value) => value + 1)}
                className="text-xs font-bold text-primary hover:underline"
              >
                다시 불러오기
              </button>
            </div>
          ) : resumes.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 bg-white px-4 py-4 text-center">
              <p className="text-sm font-bold text-gray-800">먼저 제출할 이력서를 만들어주세요.</p>
              <p className="mt-1 text-xs text-gray-500">기본 정보·학력·경력·자격증을 등록한 후 지원할 수 있습니다.</p>
              <Link href={resumeManagerHref} className="btn-primary mt-3 inline-flex text-xs">
                이력서 만들기
              </Link>
            </div>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="제출할 이력서 선택">
              {resumes.map((resume) => {
                const active = resume.id === selectedResumeId;
                const ready = isResumeContentSubmittable(resume, resume.completenessScore);
                const photoUrl = resolveResumePhotoUrl(resume.photoPath);
                return (
                  <button
                    key={resume.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedResumeId(resume.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${active ? 'border-primary bg-primary-50 ring-1 ring-primary' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                      {active && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </span>
                    <span className="h-12 w-9 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
                      {photoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                        : <span className="flex h-full items-center justify-center text-sm font-bold text-gray-300">{(resume.title || '이').charAt(0)}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`truncate text-sm font-bold ${active ? 'text-primary' : 'text-gray-900'}`}>{resume.title}</span>
                        {resume.isDefault && <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">대표</span>}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 w-full max-w-[110px] overflow-hidden rounded-full bg-gray-100">
                          <span className={`block h-full rounded-full ${ready ? 'bg-primary' : 'bg-gray-300'}`} style={{ width: `${resume.completenessScore}%` }} />
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-gray-500">
                          완성도 {resume.completenessScore}%{ready ? '' : ' · 60% 필요'}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
              {selectedResume && !resumeReady && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                  <p className="font-semibold text-gray-600">
                    {!selectedResume.fullName.trim() ? '이름을 입력해야 지원할 수 있어요.' : '완성도 60% 이상이어야 지원할 수 있어요.'}
                  </p>
                  <Link href={resumeManagerHref} className="shrink-0 font-bold text-primary hover:underline">이력서 채우기 →</Link>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-700">경력/강점 <span className="font-normal text-gray-400">(선택)</span></span>
            <input
              value={careerSummary}
              onChange={(e) => setCareerSummary(e.target.value)}
              maxLength={500}
              className="input-field"
              placeholder="예) 웨딩플래너 2년, 예식 당일 진행 경험"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-700">가능 일정 <span className="font-normal text-gray-400">(선택)</span></span>
            <input
              value={availableSchedule}
              onChange={(e) => setAvailableSchedule(e.target.value)}
              maxLength={300}
              className="input-field"
              placeholder="예) 주말 가능, 7월부터 출근 가능"
            />
          </label>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4_000}
          rows={5}
          aria-label="지원 쪽지"
          className="input-field resize-none"
          placeholder="왜 이 공고에 지원하는지, 바로 맡을 수 있는 업무, 확인이 필요한 조건을 적어주세요."
        />
        <div>
          <label className="block mb-1 text-xs font-bold text-gray-700">
            연락처 <span className="text-rose-500">*</span>
            {(selectedResume?.phone || profile?.phone) && (
              <span className="ml-1.5 text-[11px] font-semibold text-gray-500">
                · 등록: {formatPhone(selectedResume?.phone || profile?.phone || '')}
              </span>
            )}
          </label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            maxLength={40}
            className="input-field"
            placeholder={selectedResume?.phone || profile?.phone ? '다른 연락처를 제출하려면 입력' : '예: 010-1234-5678'}
            required={!selectedResume?.phone && !profile?.phone}
            aria-required="true"
          />
          {!phoneAvailable && (
            <p className="mt-1 text-[11px] text-rose-500">
              지원자와 연락하기 위해 연락처가 필요합니다.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || resumesLoading || !selectedResume || !resumeReady}
            className="btn-primary"
          >
            {submitting ? '이력서 제출 중...' : `${actionLabel} 접수`}
          </button>
        </div>
      </div>
    </section>
  );
}

function ApplicantSnapshot({ applicant, contactPhone }: { applicant: Profile; contactPhone: string | null }) {
  const details = [
    getPrimaryBusinessTypeLabel(applicant.business_type, 2),
    getRegionLabel(applicant.region),
    applicant.website ? '웹사이트 있음' : '',
    contactPhone || applicant.phone ? '연락 가능' : '',
  ].filter(Boolean);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {details.map((detail) => (
        <span key={detail} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500">
          {detail}
        </span>
      ))}
      {applicant.response_rate > 0 && (
        <span className="rounded-full border border-primary/30 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary">
          응답률 {Math.round(applicant.response_rate)}%
        </span>
      )}
    </div>
  );
}

function AuthorNoteEditor({
  application,
  onChange,
}: {
  application: Application;
  onChange: (next: Application) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(application.author_note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await withTimeout(applicationService.setAuthorNote(application.id, draft.trim()), 10000, '메모 저장 지연');
      onChange(updated);
      setEditing(false);
      toast('메모를 저장했습니다.', 'success');
    } catch {
      toast('메모 저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 rounded border border-dashed border-gray-200 p-3 text-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-bold text-gray-700">내 메모 <span className="text-gray-400">(비공개)</span></p>
          <button type="button" onClick={() => { setDraft(application.author_note ?? ''); setEditing(true); }} className="text-primary font-bold hover:underline">
            {application.author_note ? '수정' : '+ 추가'}
          </button>
        </div>
        {application.author_note ? (
          <p className="whitespace-pre-wrap text-gray-700">{application.author_note}</p>
        ) : (
          <p className="text-gray-400">지원자에 대한 비공개 메모를 남겨두면 나중에 참고하기 좋아요.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded border border-gray-300 p-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={5_000}
        aria-label="지원자 비공개 메모"
        placeholder="이 지원자에 대한 비공개 메모 (다른 사용자에게는 보이지 않습니다)"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none resize-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs text-gray-500 hover:text-gray-700">
          취소
        </button>
        <button type="button" onClick={save} disabled={saving} className="rounded border border-primary bg-primary px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

function ApplicationCompletionRow({
  application,
  side,
  disabled = false,
  onMark,
}: {
  application: Application;
  side: 'hiring' | 'applicant';
  disabled?: boolean;
  onMark: () => void;
}) {
  const mine = side === 'hiring' ? application.hiring_completed_at : application.applicant_completed_at;
  const other = side === 'hiring' ? application.applicant_completed_at : application.hiring_completed_at;
  // bothDone 시 리뷰 작성 링크
  const reviewHref = `/applications/${application.id}/review`;
  const bothDone = !!mine && !!other;

  return (
    <div className="mt-3 rounded border border-gray-200 p-3 text-xs">
      {bothDone ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900 inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> 진행 완료</p>
            <p className="text-gray-500 mt-0.5">함께 진행한 상대에 대한 리뷰를 30일 이내 작성해 주세요.</p>
          </div>
          <a
            href={reviewHref}
            className="shrink-0 rounded border border-primary bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
          >
            리뷰 작성 →
          </a>
        </div>
      ) : mine ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-gray-900 inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> 내 측 완료 표시</span>
          <span className="text-gray-500">상대방 확인 대기 중</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900">진행 완료 표시</p>
            <p className="text-gray-500 mt-0.5">{other ? '상대방이 먼저 완료 처리했어요. 확인해 주세요.' : '지원 이후 실제 진행이 마무리되었다면 표시해 주세요.'}</p>
          </div>
          <button
            type="button"
            onClick={onMark}
            disabled={disabled}
            className="shrink-0 rounded border border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors disabled:cursor-wait disabled:opacity-50"
          >
            완료 표시
          </button>
        </div>
      )}
    </div>
  );
}
