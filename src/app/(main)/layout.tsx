import Header from '@/shared/components/Header';
import Footer from '@/shared/components/Footer';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-4 py-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
