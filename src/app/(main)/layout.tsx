import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-5 sm:py-6 lg:py-8">
        {/* 기본 폭: .shell-wide(1440). 더 좁은 폭이 필요한 페이지는 자체 div에서 .shell-narrow / .shell 사용해 override.
            mypage는 자체 layout에서 grid를 사용하므로 outer shell이 max-w를 처리. */}
        <div className="shell-wide">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
