import { LANDINGS } from '@/features/seo/landings';
import { getOpenJobs } from '@/features/seo/openJobs';
import { BUSINESS_TYPES } from '@/shared/constants';
import { getBusinessTypeLabel, getEmploymentTypeLabel, getRegionLabel } from '@/shared/utils/format';
import { CONTACT_EMAIL_DEFAULT, OG_SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/shared/seo';

// /llms.txt — AI 검색·답변 엔진(ChatGPT·Perplexity·Claude 등)이 사이트를 빠르게 파악하도록 쓴
// 마크다운 요약(llmstxt.org 형식). 서비스 소개·주요 페이지·업종별 가이드·최근 모집 공고를 담는다.
export const dynamic = 'force-dynamic';

const RECENT_JOBS_LIMIT = 20;
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || CONTACT_EMAIL_DEFAULT;

/** 마크다운 링크 텍스트가 깨지지 않게 대괄호·줄바꿈을 정리한다(공고 제목에 '[업체명]'이 흔함). */
function mdText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/([[\]])/g, '\\$1').trim();
}

export async function GET() {
  const jobs = await getOpenJobs({ limit: RECENT_JOBS_LIMIT });

  const jobLines = jobs.map((job) => {
    const company = job.author?.company_name || job.author?.contact_name || job.proxy_company_name || '';
    const firstRegion = job.region ? job.region.split(',')[0] : '';
    const facets = [
      company,
      firstRegion ? getRegionLabel(firstRegion) : '',
      getBusinessTypeLabel(job.business_type),
      getEmploymentTypeLabel(job.employment_type),
    ].filter(Boolean).join(' · ');
    return `- [${mdText(job.title)}](${SITE_URL}/jobs/${job.id})${facets ? `: ${mdText(facets)}` : ''}`;
  });

  const lines = [
    `# ${OG_SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    '마리에(Marié, marie.co.kr)는 한국 웨딩 업계 전문 채용·구인구직 플랫폼입니다. 웨딩 업계에서 일자리를 찾는 사람과 사람을 구하는 웨딩 업체를 잇습니다.',
    `다루는 업종: ${BUSINESS_TYPES.map((b) => b.label).join(', ')}.`,
    '채용 공고 등록과 지원은 현재 무료입니다. 개인 회원은 이력서를 등록해 공고에 지원하고, 업체 회원은 채용 공고를 등록합니다.',
    '',
    '## 주요 페이지',
    `- [서비스 소개](${SITE_URL}/about): 마리에가 무엇이고 어떻게 이용하는지, 자주 묻는 질문`,
    `- [채용정보](${SITE_URL}/jobs): 웨딩 업계 채용 공고 목록(업종·지역·고용형태 필터)`,
    `- [인재·업체 프로필](${SITE_URL}/directory): 웨딩 업체와 인재 프로필`,
    `- [커뮤니티](${SITE_URL}/community): 웨딩 업계 소식·실무 노하우·취업 팁`,
    `- [행사·박람회](${SITE_URL}/events): 웨딩 박람회·채용 행사 일정`,
    `- [고객센터](${SITE_URL}/contact): 이용 문의와 자주 묻는 질문`,
    '',
    '## 업종별 채용 가이드',
    ...LANDINGS.map((l) => `- [${mdText(l.title)}](${SITE_URL}/guide/${l.slug}): ${mdText(l.description)}`),
    '',
    '## 최근 모집 중인 채용 공고',
    ...(jobLines.length > 0 ? jobLines : ['- 현재 모집 중인 공고가 없습니다.']),
    '',
    '## 문의',
    `- 이메일: ${CONTACT_EMAIL}`,
    '',
    '## Optional',
    `- [사이트맵](${SITE_URL}/sitemap.xml)`,
    `- [RSS 피드](${SITE_URL}/rss.xml)`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
