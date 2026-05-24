import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-6">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
