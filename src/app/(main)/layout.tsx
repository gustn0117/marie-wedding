import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-5 sm:py-6 lg:py-8">
        {/* 페이지가 .shell / .shell-narrow / .shell-wide 중 하나를 자체적으로 선택.
            이전에는 max-w-[1440px] 강제로 좁은 폼 페이지까지 1440 폭 안에 끼어 정렬 어긋남. */}
        {children}
      </main>
      <Footer />
    </div>
  );
}
