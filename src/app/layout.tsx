import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import NavigationProgress from "@/shared/components/NavigationProgress";
import { ToastProvider } from "@/shared/components/Toast";
import "./globals.css";

/**
 * viewport-fit=cover — env(safe-area-inset-*) 값이 실제로 채워지도록 활성화.
 * 없으면 iOS Notch/홈 인디케이터 대응이 반쪽 (inset 이 항상 0).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  // OG 이미지/canonical URL 기준. 도메인 이관 시 여기 값만 갱신.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://marie.co.kr'),
  title: "Marié - 웨딩 업계 구인구직 플랫폼",
  description: "웨딩 업계 종사자를 위한 채용, 프로필, 커뮤니티 플랫폼",
  // 카카오톡·페이스북 등 링크 미리보기 이미지. public/og-image.png (1200×630) 사용.
  openGraph: {
    type: "website",
    siteName: "마리에 Marié",
    title: "Marié - 웨딩 업계 구인구직 플랫폼",
    description: "웨딩 업계 종사자를 위한 채용, 프로필, 커뮤니티 플랫폼",
    url: "/",
    locale: "ko_KR",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "마리에 Marié" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marié - 웨딩 업계 구인구직 플랫폼",
    description: "웨딩 업계 종사자를 위한 채용, 프로필, 커뮤니티 플랫폼",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
  },
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
