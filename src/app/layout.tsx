import type { Metadata } from "next";
import { Suspense } from "react";
import NavigationProgress from "@/shared/components/NavigationProgress";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marié - 웨딩 업계 B2B 네트워크",
  description: "웨딩 업계 종사자를 위한 채용, 네트워킹, 정보 공유 플랫폼",
  icons: {
    icon: '/favicon.ico',
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
        {children}
      </body>
    </html>
  );
}
