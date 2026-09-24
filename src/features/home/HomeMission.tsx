import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import BusinessTypeIcon from '@/shared/components/icons/BusinessTypeIcon';

// 업종별 바로가기 — SVG 아이콘 (이모지 사용 금지, 미니멀 무채색 팔레트 준수).
const CATEGORIES: { key: string; label: string; iconKey: string }[] = [
  { key: 'venue',     label: '예식장',     iconKey: 'venue' },
  { key: 'dress',     label: '드레스샵',   iconKey: 'dress' },
  { key: 'studio',    label: '스튜디오',   iconKey: 'studio' },
  { key: 'makeup',    label: '메이크업',   iconKey: 'makeup' },
  { key: 'planner',   label: '플래너',     iconKey: 'planner' },
  { key: 'assistant', label: '예식도우미', iconKey: 'assistant' },
  { key: 'mc',        label: '사회자',     iconKey: 'mc' },
  { key: 'singer',    label: '축가',       iconKey: 'singer' },
  { key: 'designer',  label: '디자이너',   iconKey: 'designer' },
  { key: '',          label: '전체보기',   iconKey: 'all' },
];

/** 메인 소개 문구 + 업종별 채용정보 바로가기 */
export default function HomeMission() {
  return (
    <section className="bg-white pb-12 pt-16 sm:pb-16 sm:pt-24">
      <div className="shell-wide">
        <div className="flex flex-col items-center text-center">
          {/* 컨테이너 비율을 이미지 실제 비율(240×405 ≒ 0.593)에 맞춘다.
              어긋나면 object-contain 이 letterbox 를 만들어 반지가 박스보다 작게 보인다. */}
          <div
            className="hero-ring-float relative mb-6 h-[61px] w-[36px] sm:mb-8 sm:h-[81px] sm:w-[48px]"
            aria-hidden="true"
          >
            <Image
              src="/images/hero-ring-premium-silver.png"
              alt=""
              fill
              draggable={false}
              sizes="(min-width: 640px) 48px, 36px"
              className="select-none object-contain"
            />
          </div>
          <h2 className="break-keep text-[26px] font-bold leading-[1.3] tracking-[-0.03em] text-ink sm:text-[36px] lg:text-[44px]">
            웨딩의 모든 순간은 사람이 만듭니다.
          </h2>
          <p className="mt-5 border-b-2 border-primary pb-0.5 text-[13px] font-bold tracking-[0.02em] text-primary sm:mt-6 sm:text-[14px]">
            MISSION STATEMENT
          </p>
          <p className="mt-5 max-w-[640px] break-keep text-[15px] leading-[1.75] text-gray-600 sm:mt-6 sm:text-[17px]">
            마리에는 예식장·드레스·스튜디오·메이크업·플래너까지, 웨딩 업계에서 일하는 사람과 업체를 가장 가까이 잇는 채용 플랫폼입니다.
          </p>
        </div>

        <nav aria-label="업종별 채용정보" className="mx-auto mt-12 grid max-w-[1080px] grid-cols-5 gap-2 sm:mt-16 sm:gap-3 lg:grid-cols-10">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              href={c.key ? `${ROUTES.JOBS}?businessType=${c.key}` : ROUTES.JOBS}
              className="cat-tile"
            >
              <span className={`cat-tile-icon ${c.key ? 'bg-gray-50' : 'bg-gray-100'} text-gray-700`}>
                <BusinessTypeIcon type={c.iconKey} className="w-6 h-6 sm:w-7 sm:h-7" />
              </span>
              <span className="cat-tile-label break-keep text-[12px] sm:text-[13px]">{c.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
