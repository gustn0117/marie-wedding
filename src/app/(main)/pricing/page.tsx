import Link from 'next/link';
import { cookies } from 'next/headers';
import CheckoutButton from '@/features/payments/components/CheckoutButton';
import { PREMIUM_PRODUCTS } from '@/features/payments/lib/premium-products';
import { ROUTES } from '@/shared/constants';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata = { title: '광고 상품 | Marié' };

export default async function PricingPage({ searchParams }: { searchParams: { cycle?: string } }) {
  const cycle = searchParams.cycle === 'yearly' ? 'yearly' : 'monthly';
  const cookieStore = await cookies();
  const isLoggedIn = !!cookieStore.get('marie_profile')?.value;

  return (
    <div className="max-w-[1080px] mx-auto space-y-6">
      <PageHeader
        title="광고 상품"
        description="웨딩업계 채용 수요가 모이는 지면에서 공고와 브랜드를 더 잘 보이게 만드세요."
      />

      {/* 결제 주기 토글 */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-full bg-gray-100">
          <Link
            href={{ query: { cycle: 'monthly' } }}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
              cycle === 'monthly' ? 'bg-white text-ink shadow-sm' : 'text-gray-500'
            }`}
          >
            월간 결제
          </Link>
          <Link
            href={{ query: { cycle: 'yearly' } }}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
              cycle === 'yearly' ? 'bg-white text-ink shadow-sm' : 'text-gray-500'
            }`}
          >
            연간 결제 <span className="text-xs text-primary font-bold ml-1">-17%</span>
          </Link>
        </div>
      </div>

      {/* 플랜 카드 3개 */}
      <div className="grid md:grid-cols-3 gap-4">
        {PREMIUM_PRODUCTS.map((p) => {
          const price = cycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
          const isContactSales = p.tier === 'enterprise';
          return (
            <article
              key={p.tier}
              className={`rounded-2xl p-6 ${
                p.highlight ? 'border-2 border-ink bg-ink text-white shadow-lg' : 'border border-gray-200 bg-white'
              }`}
            >
              <header className="mb-5">
                {p.highlight && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary text-white mb-2">
                    가장 인기
                  </span>
                )}
                <h2 className={`text-xl font-bold mb-1 ${p.highlight ? 'text-white' : 'text-ink'}`}>{p.name}</h2>
                {isContactSales ? (
                  <p className={`text-sm ${p.highlight ? 'text-white/80' : 'text-gray-500'}`}>별도 협의</p>
                ) : (
                  <p>
                    <span className={`text-3xl font-bold tabular-nums ${p.highlight ? 'text-white' : 'text-ink'}`}>
                      {new Intl.NumberFormat('ko-KR').format(price)}
                    </span>{' '}
                    <span className={`text-sm font-bold ${p.highlight ? 'text-white/80' : 'text-gray-500'}`}>
                      원/{cycle === 'yearly' ? '년' : '월'}
                    </span>
                  </p>
                )}
              </header>

              <ul className={`space-y-2 mb-6 text-sm ${p.highlight ? 'text-white/90' : 'text-gray-700'}`}>
                {p.features.map((feat) => (
                  <li key={feat} className="flex gap-2">
                    <svg className={`w-4 h-4 shrink-0 mt-0.5 ${p.highlight ? 'text-primary-100' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* 액션 */}
              {!isLoggedIn ? (
                <Link
                  href={ROUTES.LOGIN}
                  className={`block w-full text-center py-3 rounded-lg text-sm font-bold ${
                    p.highlight ? 'bg-white text-ink hover:bg-gray-100' : 'btn-outline'
                  }`}
                >
                  로그인 후 결제
                </Link>
              ) : isContactSales ? (
                <Link
                  href="/contact"
                  className={`block w-full text-center py-3 rounded-lg text-sm font-bold ${
                    p.highlight ? 'bg-white text-ink hover:bg-gray-100' : 'btn-outline'
                  }`}
                >
                  도입 문의
                </Link>
              ) : (
                <CheckoutButton
                  input={{
                    productType: 'premium_tier',
                    amount: price,
                  orderName: `Marié ${p.name} 광고 (${cycle === 'yearly' ? '연간' : '월간'})`,
                    metadata: { tier: p.tier, cycle },
                  }}
                  label={`${p.name} 결제`}
                  className={`block w-full text-center py-3 rounded-lg text-sm font-bold ${
                    p.highlight ? 'bg-white text-ink hover:bg-gray-100' : 'btn-primary'
                  }`}
                />
              )}
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 pt-4">
        결제 게이트웨이: PortOne · 결제 정보는 안전하게 암호화됩니다.
      </p>
    </div>
  );
}
