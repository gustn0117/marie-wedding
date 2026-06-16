import type { Metadata } from "next";
import { Suspense } from "react";
import NavigationProgress from "@/shared/components/NavigationProgress";
import { ToastProvider } from "@/shared/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marié - 웨딩 업계 구인구직 플랫폼",
  description: "웨딩 업계 종사자를 위한 채용, 프로필, 커뮤니티 플랫폼",
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
