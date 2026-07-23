import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import NavigationProgress from "@/shared/components/NavigationProgress";
import { ToastProvider } from "@/shared/components/Toast";
import { SITE_URL, SITE_NAME, SITE_NAME_KO, SITE_TAGLINE, SITE_DESCRIPTION } from "@/shared/seo";
import "./globals.css";

/**
 * viewport-fit=cover — env(safe-area-inset-*) 값이 실제로 채워지도록 활성화.
 * 없으면 iOS Notch/홈 인디케이터 대응이 반쪽 (inset 이 항상 0).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#051049',
};

const DEFAULT_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

// 검색엔진 등록용 소유확인 토큰(설정 시에만 주입). 구글 서치콘솔·네이버 서치어드바이저·빙.
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
const naverVerification = process.env.NAVER_SITE_VERIFICATION;
const bingVerification = process.env.BING_SITE_VERIFICATION;
const otherVerification: Record<string, string> = {};
if (naverVerification) otherVerification['naver-site-verification'] = naverVerification;
if (bingVerification) otherVerification['msvalidate.01'] = bingVerification;

export const metadata: Metadata = {
  // OG 이미지/canonical URL 기준 — 항상 운영 도메인(marie.co.kr)로 고정(@/shared/seo).
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    '웨딩 채용', '웨딩 구인구직', '웨딩 일자리', '웨딩 플래너 채용', '예식장 채용',
    '스튜디오 채용', '드레스샵 채용', '헤어메이크업 채용', '예식 도우미', '웨딩 알바',
    '웨딩 업계', '마리에', 'Marié', '웨딩 인재', '웨딩 업체',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  // 주의: 루트에 alternates.canonical 을 두면 자체 canonical 이 없는 하위 페이지가
  // 전부 '/'(홈)로 정규화돼 중복 취급된다. canonical 은 각 페이지에서 자기 자신으로 지정.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  // 카카오톡·페이스북 등 링크 미리보기 이미지. public/og-marie.png (1200×630) 사용.
  openGraph: {
    type: "website",
    siteName: `${SITE_NAME_KO} ${SITE_NAME}`,
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "ko_KR",
    images: [{ url: "/og-marie.png", width: 1200, height: 630, alt: `${SITE_NAME_KO} ${SITE_NAME}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-marie.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  ...(googleVerification || Object.keys(otherVerification).length > 0
    ? {
        verification: {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(Object.keys(otherVerification).length > 0 ? { other: otherVerification } : {}),
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
