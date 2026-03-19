'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/shared/constants';
import {
  formatDate,
  formatRelativeTime,
  getBusinessTypeLabel,
  getEmploymentTypeLabel,
  getRegionLabel,
} from '@/shared/utils/format';
import { jobService } from '@/features/jobs/services/job-service';
import type { Job } from '@/types/database';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const jobId = params.id as string;
  const isAuthor = profile && job?.author_id === profile.id;

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobService.getJobById(jobId);
      if (!data) {
        setError('존재하지 않는 공고입니다.');
      } else {
        setJob(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '공고를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleDelete = async () => {
    if (!confirm('정말로 이 공고를 삭제하시겠습니까?')) return;

    setDeleting(true);
    try {
      await jobService.deleteJob(jobId);
      router.push(ROUTES.JOBS);
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
      setDeleting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-5 w-24 rounded bg-secondary" />
        <div className="card p-8 space-y-4">
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-full bg-secondary" />
            <div className="h-7 w-20 rounded-full bg-secondary" />
          </div>
          <div className="h-9 w-3/4 rounded bg-secondary" />
          <div className="h-4 w-1/3 rounded bg-secondary" />
          <div className="h-px bg-secondary my-4" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-secondary" />
            <div className="h-4 w-full rounded bg-secondary" />
            <div className="h-4 w-2/3 rounded bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card p-8 text-center space-y-4">
          <h2 className="font-serif text-lg font-semibold text-text-primary">
            {error ?? '공고를 찾을 수 없습니다'}
          </h2>
          <Link href={ROUTES.JOBS} className="btn-outline text-sm inline-block">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = job.deadline ? new Date(job.deadline) < new Date() : false;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Navigation */}
      <Link
        href={ROUTES.JOBS}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-200"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      {/* Main Card */}
      <article className="card overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-8 space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {job.is_urgent && (
              <span className="badge-urgent text-xs font-semibold px-3 py-1 rounded-full">
                긴급
              </span>
            )}
            <span className="badge-primary text-xs font-medium px-3 py-1 rounded-full">
              {getEmploymentTypeLabel(job.employment_type)}
            </span>
            <span className="badge-accent text-xs font-medium px-3 py-1 rounded-full">
              {getBusinessTypeLabel(job.business_type)}
            </span>
            {isExpired && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                마감됨
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-text-primary leading-tight">
            {job.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span className="font-medium">
              {job.author?.company_name ?? '알 수 없음'}
            </span>
            <span className="text-border">|</span>
            <span>{getRegionLabel(job.region)}</span>
            <span className="text-border">|</span>
            <time dateTime={job.created_at}>{formatRelativeTime(job.created_at)}</time>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Info Grid */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <InfoItem label="업종" value={getBusinessTypeLabel(job.business_type)} />
            <InfoItem label="고용형태" value={getEmploymentTypeLabel(job.employment_type)} />
            <InfoItem label="지역" value={getRegionLabel(job.region)} />
            {job.salary_info && <InfoItem label="급여" value={job.salary_info} />}
            {job.deadline && (
              <InfoItem
                label="마감일"
                value={formatDate(job.deadline)}
                highlight={isExpired}
              />
            )}
            <InfoItem label="등록일" value={formatDate(job.created_at)} />
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-text-primary">상세 내용</h2>
            <div className="prose prose-sm max-w-none text-text-secondary whitespace-pre-wrap leading-relaxed">
              {job.description}
            </div>
          </div>
        </div>

        {/* Author Info */}
        {job.author && (
          <>
            <div className="border-t border-border" />
            <div className="p-6 md:p-8">
              <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">업체 정보</h2>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-serif font-bold text-lg">
                    {job.author.company_name.charAt(0)}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-text-primary">{job.author.company_name}</p>
                  <p className="text-sm text-text-secondary">{getRegionLabel(job.author.region)}</p>
                  {job.author.bio && (
                    <p className="text-sm text-text-muted mt-2">{job.author.bio}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Author Actions */}
        {isAuthor && (
          <>
            <div className="border-t border-border" />
            <div className="p-6 md:p-8 flex items-center gap-3">
              <Link
                href={`${ROUTES.JOBS_DETAIL(job.id)}/edit`}
                className="btn-outline text-sm px-5 py-2.5"
              >
                수정하기
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function InfoItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-red-500' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}
