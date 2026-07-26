import type { Job } from '@/types/database';
import { getRegionLabel } from '@/shared/utils/format';
import { resolveStorageUrl } from '@/shared/utils/storageUrl';
import { absoluteUrl, normalizeExternalUrl, SITE_NAME } from '@/shared/seo';

// schema.org employmentType 매핑
const EMPLOYMENT_MAP: Record<string, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
};

// baseSalary 주기 단위(QuantitativeValue.unitText)
const SALARY_UNIT_MAP: Record<string, string> = {
  monthly: 'MONTH',
  yearly: 'YEAR',
  daily: 'DAY',
  hourly: 'HOUR',
};

/**
 * Google for Jobs 용 JobPosting 구조화 데이터.
 * 급여 단위 함정: 월급/연봉은 '만원' 단위 저장(×10,000), 일급/시급은 '원' 단위 그대로.
 */
export function buildJobPostingJsonLd(job: Job): Record<string, unknown> {
  // 대행 공고는 author 가 없다. 폴백이 없으면 구인 주체가 'Marié' 로 나가 사실과 달라진다.
  const orgName = job.author?.company_name || job.author?.contact_name || job.proxy_company_name || SITE_NAME;
  const regionLabel = job.region && job.region !== 'all' ? getRegionLabel(job.region) : '';
  const jobImage = resolveStorageUrl(job.image, 'job-images');
  const orgLogo = resolveStorageUrl(job.author?.profile_image, 'avatars');

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.title,
    datePosted: job.created_at,
    url: absoluteUrl(`/jobs/${job.id}`),
    identifier: {
      '@type': 'PropertyValue',
      name: orgName,
      value: job.id,
    },
    hiringOrganization: {
      '@type': 'Organization',
      name: orgName,
      ...(job.author?.id ? { sameAs: absoluteUrl(`/directory/${job.author.id}`) } : {}),
      ...(normalizeExternalUrl(job.author?.website) ? { url: normalizeExternalUrl(job.author?.website) } : {}),
      ...(orgLogo ? { logo: orgLogo } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        ...(regionLabel ? { addressRegion: regionLabel } : {}),
      },
    },
  };

  if (job.deadline) data.validThrough = job.deadline;

  const employmentType = EMPLOYMENT_MAP[job.employment_type];
  if (employmentType) data.employmentType = employmentType;

  if (jobImage) data.image = jobImage;

  // baseSalary — 값이 하나라도 있을 때만. 만원/원 단위 분기.
  if (job.salary_min != null || job.salary_max != null) {
    const unitText = SALARY_UNIT_MAP[job.salary_unit] || 'MONTH';
    const multiplier = job.salary_unit === 'monthly' || job.salary_unit === 'yearly' ? 10000 : 1;
    const min = job.salary_min != null ? job.salary_min * multiplier : null;
    const max = job.salary_max != null ? job.salary_max * multiplier : null;
    const qv: Record<string, unknown> = { '@type': 'QuantitativeValue', unitText };
    if (min != null && max != null) {
      qv.minValue = min;
      qv.maxValue = max;
    } else {
      qv.value = min != null ? min : max;
    }
    data.baseSalary = { '@type': 'MonetaryAmount', currency: 'KRW', value: qv };
  }

  if (job.experience_min != null && job.experience_min > 0) {
    data.experienceRequirements = {
      '@type': 'OccupationalExperienceRequirements',
      monthsOfExperience: job.experience_min * 12,
    };
  }

  return data;
}
