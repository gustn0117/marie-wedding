import { resolveResumePhotoUrl, resolveResumeAttachmentUrl } from '@/features/resumes/lib/photo';
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

function fmtYm(value: string): string {
  const [y, m] = value.split('-');
  if (!y) return '';
  return m ? `${y}.${m}` : y;
}

function period(start: string, end: string, current: boolean) {
  if (!start && !end && !current) return '';
  const s = fmtYm(start) || '—';
  const e = current ? '현재' : fmtYm(end) || '—';
  return `${s} – ${e}`;
}

// 인라인 아이콘 (연락처 행)
function ContactIcon({ path }: { path: string }) {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}
const ICON = {
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  mail: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  cake: 'M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.126-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z',
  pin: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
};

export default function ResumePreview({ resume, className = '', submittedAt }: ResumePreviewProps) {
  if ('redacted' in resume && resume.redacted) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-10 text-center ${className}`}>
        <p className="text-base font-bold text-gray-700">탈퇴한 회원의 이력서입니다</p>
        <p className="mt-2 text-sm text-gray-500">개인정보 보호를 위해 제출 내용이 삭제되었습니다.</p>
      </div>
    );
  }

  const data = resume as ResumeContent;
  const attachments = data.attachments ?? [];
  const photoUrl = resolveResumePhotoUrl(data.photoPath);
  const experiences = [...data.experiences].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const educations = [...data.educations].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const contacts: { icon: string; text: string }[] = [
    data.phone && { icon: ICON.phone, text: data.phone },
    data.email && { icon: ICON.mail, text: data.email },
    data.birthDate && { icon: ICON.cake, text: data.birthDate },
    data.address && { icon: ICON.pin, text: data.address },
  ].filter(Boolean) as { icon: string; text: string }[];

  const desired: { label: string; items: string[] }[] = [
    { label: '직무', items: data.desiredRoles },
    { label: '지역', items: data.desiredRegions },
    { label: '고용형태', items: data.desiredEmploymentTypes },
  ].filter((g) => g.items.length > 0);

  return (
    <article className={`resume-sheet overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {/* ── 헤더: 이름이 히어로, 네이비 액센트 룰 ── */}
      <header className="px-7 pt-8 sm:px-10 sm:pt-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm sm:w-[104px]">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={`${data.fullName || '지원자'} 증명사진`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl font-bold text-gray-200">
                {(data.fullName || '?').charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-primary">Résumé</p>
            <h2 className="mt-1.5 text-[30px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[34px]">{data.fullName || '이름 미입력'}</h2>
            {data.headline && <p className="mt-2 text-[15px] font-medium leading-relaxed text-gray-600">{data.headline}</p>}
          </div>
        </div>
        {contacts.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-gray-600">
            {contacts.map((c) => (
              <span key={c.text} className="inline-flex items-center gap-1.5"><ContactIcon path={c.icon} />{c.text}</span>
            ))}
          </div>
        )}
        <div className="mt-6 h-1 w-full rounded-full bg-gradient-to-r from-primary to-primary/25" />
        {submittedAt && <p className="mt-3 text-[11px] text-gray-400">제출일 {new Date(submittedAt).toLocaleString('ko-KR')}</p>}
      </header>

      <div className="space-y-9 px-7 py-9 sm:px-10 sm:py-10">
        {desired.length > 0 && (
          <Section title="희망 조건">
            <dl className="space-y-2.5">
              {desired.map((group) => (
                <div key={group.label} className="flex gap-4">
                  <dt className="w-16 shrink-0 text-[13px] font-semibold text-gray-400">{group.label}</dt>
                  <dd className="text-[14px] font-medium leading-6 text-gray-800">{group.items.join('   ·   ')}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {data.summary && (
          <Section title="자기소개">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-7 text-gray-700">{data.summary}</p>
          </Section>
        )}

        {experiences.length > 0 && (
          <Section title="경력">
            <div className="space-y-6">
              {experiences.map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.company || '회사명 미입력'}
                  subtitle={item.position}
                  period={period(item.startDate, item.endDate, item.isCurrent)}
                  current={item.isCurrent}
                  description={item.description}
                />
              ))}
            </div>
          </Section>
        )}

        {educations.length > 0 && (
          <Section title="학력">
            <div className="space-y-6">
              {educations.map((item) => (
                <TimelineItem
                  key={item.id}
                  title={item.school || '학교명 미입력'}
                  subtitle={[item.major, RESUME_DEGREE_LABELS[item.degree]].filter(Boolean).join(' · ')}
                  period={period(item.startDate, item.endDate, item.isCurrent)}
                  current={item.isCurrent}
                  description={item.description}
                />
              ))}
            </div>
          </Section>
        )}

        {data.skills.length > 0 && (
          <Section title="기술과 강점">
            <p className="text-[14px] font-medium leading-7 text-gray-800">{data.skills.join('   ·   ')}</p>
          </Section>
        )}

        {data.certificates.length > 0 && (
          <Section title="자격증">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {data.certificates.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <p className="text-[14px] font-bold text-gray-900">{item.name || '자격증명 미입력'}</p>
                  <p className="mt-1 text-[12px] text-gray-500">{[item.issuer, fmtYm(item.acquiredDate) || item.acquiredDate].filter(Boolean).join(' · ')}</p>
                  {item.credentialId && <p className="mt-0.5 text-[11px] text-gray-400">자격번호 {item.credentialId}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {data.languages.length > 0 && (
          <Section title="외국어">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {data.languages.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-gray-900">{item.language || '언어 미입력'}</p>
                    {(item.testName || item.score) && <p className="mt-0.5 text-[11px] text-gray-400">{[item.testName, item.score].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200">{RESUME_LANGUAGE_LEVEL_LABELS[item.level]}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {(attachments.length > 0 || data.links.some((l) => l.url)) && (
          <Section title="포트폴리오와 링크">
            {attachments.length > 0 && (
              <ul className="mb-2.5 space-y-1.5">
                {attachments.map((item) => {
                  const href = resolveResumeAttachmentUrl(item.path);
                  if (!href) return null;
                  return (
                    <li key={item.id}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 break-all text-[13px] font-semibold text-primary hover:underline">
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                        {item.name || '포트폴리오.pdf'}
                        <span className="text-[11px] font-medium text-gray-400">PDF</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.links.some((l) => l.url) && (
              <ul className="space-y-1.5">
                {data.links.map((item) => item.url && (
                  <li key={item.id}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 break-all text-[13px] font-semibold text-primary hover:underline">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                      {item.label || item.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>
    </article>
  );
}

// 섹션 — 네이비 세로 액센트 바 + 타이틀
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
        <h3 className="text-[15px] font-extrabold tracking-tight text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function TimelineItem({ title, subtitle, period: datePeriod, current, description }: { title: string; subtitle: string; period: string; current?: boolean; description: string }) {
  return (
    <div className="relative break-inside-avoid border-l-2 border-gray-100 pl-5">
      <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" aria-hidden />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[15px] font-bold text-gray-900">{title}</p>
        {datePeriod && (
          <p className="inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-gray-400">
            {current && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary">재직중</span>}
            {datePeriod}
          </p>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-[13px] font-medium text-gray-600">{subtitle}</p>}
      {description && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-gray-500">{description}</p>}
    </div>
  );
}
