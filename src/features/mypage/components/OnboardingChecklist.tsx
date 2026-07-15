import Link from 'next/link';
import type { Profile } from '@/types/database';

interface Props {
  profile: Profile;
  jobCount: number;
  resumeCount?: number;
  bestResumeCompleteness?: number;
}

interface Item {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export default function OnboardingChecklist({ profile, jobCount, resumeCount = 0, bestResumeCompleteness = 0 }: Props) {
  const businessItems: Item[] = [
    {
      key: 'profile-image',
      label: '프로필 이미지 등록',
      done: !!profile.profile_image,
      href: '/mypage/edit',
    },
    {
      key: 'bio',
      label: '업체 소개 작성',
      done: !!profile.bio && profile.bio.replace(/<[^>]+>/g, '').trim().length >= 30,
      href: '/mypage/edit',
    },
    {
      key: 'business-type',
      label: '업종 선택',
      done: !!profile.business_type,
      href: '/mypage/edit',
    },
    {
      key: 'directory',
      label: '디렉토리 공개',
      done: profile.is_directory_listed,
      href: '/mypage/directory',
    },
    {
      key: 'job',
      label: '공고 1개 이상 등록',
      done: jobCount >= 1,
      href: '/jobs/new',
    },
  ];

  const individualItems: Item[] = [
    {
      key: 'profile-image',
      label: '프로필 이미지 등록',
      done: !!profile.profile_image,
      href: '/mypage/edit',
    },
    {
      key: 'contact',
      label: '연락처와 활동 지역 입력',
      done: !!profile.phone && !!profile.region,
      href: '/mypage/edit',
    },
    {
      key: 'resume',
      label: '이력서 만들기',
      done: resumeCount > 0,
      href: '/mypage/resumes',
    },
    {
      key: 'resume-ready',
      label: '제출 가능한 이력서 완성',
      done: bestResumeCompleteness >= 60,
      href: '/mypage/resumes',
    },
  ];

  const items = profile.account_type === 'business' ? businessItems : individualItems;

  const doneCount = items.filter((i) => i.done).length;
  const percent = Math.round((doneCount / items.length) * 100);

  if (percent === 100) return null;

  return (
    <section className="platform-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">프로필 완성도</h2>
        <span className="text-sm font-bold text-primary">{percent}%</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors ${
                it.done
                  ? 'border-gray-200 bg-gray-50 text-gray-500'
                  : 'border-gray-200 text-gray-900 hover:border-primary hover:text-primary'
              }`}
            >
              <span aria-hidden className={it.done ? 'text-primary' : 'text-gray-300'}>
                {it.done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><circle cx="12" cy="12" r="9" /></svg>
                )}
              </span>
              <span className="flex-1">{it.label}</span>
              {!it.done && <span className="text-xs text-gray-400">→</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
