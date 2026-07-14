import { resolveResumePhotoUrl } from '@/features/resumes/lib/photo';
import {
  RESUME_DEGREE_LABELS,
  RESUME_LANGUAGE_LEVEL_LABELS,
  type ResumeContent,
  type SubmittedResumeSnapshot,
} from '@/features/resumes/types';

interface ResumePreviewProps {
  resume: ResumeContent | SubmittedResumeSnapshot;
  className?: string;
  submittedAt?: string | null;
}

function period(start: string, end: string, current: boolean) {
  if (!start && !end) return '';
  return `${start || '시작일 미입력'} ~ ${current ? '현재' : end || '종료일 미입력'}`;
}

export default function ResumePreview({ resume, className = '', submittedAt }: ResumePreviewProps) {
  if ('redacted' in resume && resume.redacted) {
    return (
      <div className={`rounded border border-gray-200 bg-gray-50 p-8 text-center ${className}`}>
        <p className="text-base font-bold text-gray-700">탈퇴한 회원의 이력서입니다</p>
        <p className="mt-2 text-sm text-gray-500">개인정보 보호를 위해 제출 내용이 삭제되었습니다.</p>
      </div>
    );
  }

  const data = resume as ResumeContent;
  const photoUrl = resolveResumePhotoUrl(data.photoPath);
  const experiences = [...data.experiences].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const educations = [...data.educations].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <article className={`resume-sheet overflow-hidden rounded border border-gray-200 bg-white shadow-sm ${className}`}>
      <header className="border-b border-gray-200 bg-gray-50 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="h-32 w-28 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`${data.fullName || '지원자'} 증명사진`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl font-bold text-gray-300">
                {(data.fullName || '?').charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">RESUME</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{data.fullName || '이름 미입력'}</h2>
            <p className="mt-2 text-base font-semibold text-gray-700">{data.headline || '한 줄 소개를 입력해주세요.'}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {data.phone && <span>{data.phone}</span>}
              {data.email && <span>{data.email}</span>}
              {data.birthDate && <span>{data.birthDate}</span>}
              {data.address && <span>{data.address}</span>}
            </div>
            {submittedAt && (
              <p className="mt-3 text-xs text-gray-400">제출일 {new Date(submittedAt).toLocaleString('ko-KR')}</p>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-8 p-6 sm:p-8">
        {(data.desiredRoles.length > 0 || data.desiredRegions.length > 0 || data.desiredEmploymentTypes.length > 0) && (
          <ResumeSection title="희망 조건">
            <div className="flex flex-wrap gap-2">
              {[...data.desiredRoles, ...data.desiredRegions, ...data.desiredEmploymentTypes].map((item) => (
                <span key={item} className="rounded-full border border-primary/20 bg-primary-50 px-3 py-1 text-xs font-bold text-primary">{item}</span>
              ))}
            </div>
          </ResumeSection>
        )}

        {data.summary && (
          <ResumeSection title="자기소개">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">{data.summary}</p>
          </ResumeSection>
        )}

        {experiences.length > 0 && (
          <ResumeSection title="경력">
            <div className="space-y-5">
              {experiences.map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.company || '회사명 미입력'}
                  subtitle={item.position}
                  period={period(item.startDate, item.endDate, item.isCurrent)}
                  description={item.description}
                />
              ))}
            </div>
          </ResumeSection>
        )}

        {educations.length > 0 && (
          <ResumeSection title="학력">
            <div className="space-y-5">
              {educations.map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.school || '학교명 미입력'}
                  subtitle={[item.major, RESUME_DEGREE_LABELS[item.degree]].filter(Boolean).join(' · ')}
                  period={period(item.startDate, item.endDate, item.isCurrent)}
                  description={item.description}
                />
              ))}
            </div>
          </ResumeSection>
        )}

        {data.certificates.length > 0 && (
          <ResumeSection title="자격증">
            <div className="grid gap-3 sm:grid-cols-2">
              {data.certificates.map((item) => (
                <div key={item.id} className="rounded border border-gray-200 p-4">
                  <p className="font-bold text-gray-900">{item.name || '자격증명 미입력'}</p>
                  <p className="mt-1 text-xs text-gray-500">{[item.issuer, item.acquiredDate].filter(Boolean).join(' · ')}</p>
                  {item.credentialId && <p className="mt-1 text-xs text-gray-400">자격번호 {item.credentialId}</p>}
                </div>
              ))}
            </div>
          </ResumeSection>
        )}

        {data.skills.length > 0 && (
          <ResumeSection title="기술과 강점">
            <div className="flex flex-wrap gap-2">
              {data.skills.map((skill) => <span key={skill} className="rounded bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">{skill}</span>)}
            </div>
          </ResumeSection>
        )}

        {data.languages.length > 0 && (
          <ResumeSection title="외국어">
            <div className="grid gap-3 sm:grid-cols-2">
              {data.languages.map((item) => (
                <div key={item.id} className="rounded border border-gray-200 p-4 text-sm">
                  <p className="font-bold text-gray-900">{item.language || '언어 미입력'}</p>
                  <p className="mt-1 text-gray-500">{RESUME_LANGUAGE_LEVEL_LABELS[item.level]}</p>
                  {(item.testName || item.score) && <p className="mt-1 text-xs text-gray-400">{[item.testName, item.score].filter(Boolean).join(' · ')}</p>}
                </div>
              ))}
            </div>
          </ResumeSection>
        )}

        {data.links.length > 0 && (
          <ResumeSection title="포트폴리오와 링크">
            <ul className="space-y-2">
              {data.links.map((item) => item.url && (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-primary hover:underline">
                    {item.label || item.url} →
                  </a>
                </li>
              ))}
            </ul>
          </ResumeSection>
        )}
      </div>
    </article>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-gray-200 pb-2 text-base font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function TimelineItem({ title, subtitle, period: datePeriod, description }: { title: string; subtitle: string; period: string; description: string }) {
  return (
    <div className="relative border-l-2 border-gray-200 pl-5">
      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {datePeriod && <p className="text-xs font-medium text-gray-400">{datePeriod}</p>}
      </div>
      {description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{description}</p>}
    </div>
  );
}
