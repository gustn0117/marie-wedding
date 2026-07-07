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
