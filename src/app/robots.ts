import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/seo';

// /robots.txt — 검색 크롤러 정책 + 사이트맵 위치.
// 공개 콘텐츠(홈·채용·프로필·커뮤니티·행사)는 전부 허용, 관리자/개인/작성·API 경로는 차단.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/mypage',
          '/applications',
          '/auth/',
          '/onboarding',
          '/banned',
          '/login',
          '/signup',
          '/jobs/new',
          '/community/new',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
