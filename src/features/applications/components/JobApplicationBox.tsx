'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import type { Application, ApplicationStatus } from '@/types/database';
import {
  APPLICATION_STATUS_LABELS,
  applicationService,
} from '@/features/applications/services/application-service';
import { formatRelativeTime } from '@/shared/utils/format';
import ProfileAvatar from '@/shared/components/ProfileAvatar';

interface JobApplicationBoxProps {
  jobId: string;
  authorId: string;
  postingType: string;
}

const NEXT_STATUSES: ApplicationStatus[] = ['reviewing', 'accepted', 'rejected'];

export default function JobApplicationBox({ jobId, authorId, postingType }: JobApplicationBoxProps) {
  const { profile, isLoading } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [received, setReceived] = useState<Application[]>([]);
  const [message, setMessage] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isAuthor = !!profile && profile.id === authorId;
  const actionLabel = postingType === 'matching' ? '섭외 문의' : '지원';

  useEffect(() => {
    if (isLoading) return;
    if (!profile) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        if (profile.id === authorId) {
          const rows = await applicationService.getReceivedApplications(profile.id);
          setReceived(rows.filter((row) => row.job_id === jobId));
        } else {
          const row = await applicationService.getApplicationForJob(jobId, profile.id);
          setApplication(row);
          setContactPhone(profile.phone ?? '');
        }
      } catch {
        // Keep the job readable even if the interaction layer is unavailable.
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authorId, isLoading, jobId, profile]);

  const pendingCount = useMemo(
    () => received.filter((item) => item.status === 'pending' || item.status === 'reviewing').length,
    [received],
  );

  const submit = async () => {
    if (!profile || !message.trim()) return;
    setSubmitting(true);
    try {
      const created = await applicationService.createApplication({
        jobId,
        applicantId: profile.id,
        message,
        contactPhone,
      });
      setApplication(created);
      setMessage('');
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('duplicate')
        ? '이미 접수된 내역이 있습니다.'
        : '접수에 실패했습니다.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    try {
      const updated = await applicationService.updateStatus(id, status);
      setReceived((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {
      alert('상태 변경에 실패했습니다.');
    }
  };

  if (isLoading || loading) {
    return (
      <section className="bg-white border border-gray-200 rounded p-6 md:p-8 animate-pulse">
        <div className="h-5 w-32 bg-gray-100 rounded mb-4" />
        <div className="h-24 bg-gray-100 rounded" />
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="bg-white border border-gray-200 rounded p-6 md:p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{actionLabel}하려면 로그인이 필요합니다</h2>
        <p className="text-sm text-gray-500 mb-4">마리에 프로필로 로그인한 뒤 공고 작성자에게 바로 연락할 수 있습니다.</p>
        <Link href={ROUTES.LOGIN} className="btn-primary inline-flex">로그인하기</Link>
      </section>
    );
  }

  if (isAuthor) {
    return (
      <section className="bg-white border border-gray-200 rounded p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{actionLabel} 관리</h2>
            <p className="mt-1 text-sm text-gray-500">총 {received.length}건 · 진행 중 {pendingCount}건</p>
          </div>
        </div>

        {received.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">아직 접수된 {actionLabel} 내역이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {received.map((item) => (
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
                      <span className="badge-attr">{APPLICATION_STATUS_LABELS[item.status]}</span>
                      <span className="text-xs text-gray-400">{formatRelativeTime(item.created_at)}</span>
                    </div>
                    {item.contact_phone && <p className="mt-1 text-xs text-gray-500">연락처 {item.contact_phone}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words rounded bg-secondary-50 px-3 py-2 text-sm text-gray-700">
                      {item.message}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {NEXT_STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => updateStatus(item.id, status)}
                          disabled={item.status === status}
                          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-primary hover:text-primary disabled:bg-primary disabled:text-white disabled:border-primary"
                        >
                          {APPLICATION_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (application) {
    return (
      <section className="bg-white border border-gray-200 rounded p-6 md:p-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{actionLabel} 접수 완료</h2>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="badge-primary">{APPLICATION_STATUS_LABELS[application.status]}</span>
          <span className="text-gray-400">{formatRelativeTime(application.created_at)} 접수</span>
        </div>
        <p className="whitespace-pre-wrap rounded bg-secondary-50 px-4 py-3 text-sm text-gray-700">{application.message}</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded p-6 md:p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{actionLabel}하기</h2>
      <p className="text-sm text-gray-500 mb-4">공고 작성자에게 보낼 메시지와 연락 가능한 번호를 남겨주세요.</p>
      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="input-field resize-none"
          placeholder={`${actionLabel} 메시지를 입력하세요.`}
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="input-field"
          placeholder="연락처 (선택)"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!message.trim() || submitting}
            className="btn-primary"
          >
            {submitting ? '접수 중...' : `${actionLabel} 접수`}
          </button>
        </div>
      </div>
    </section>
  );
}
