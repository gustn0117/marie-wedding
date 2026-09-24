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

/** 업종별 채용정보 바로가기 */
export default function HomeMission() {
  return (
    <section className="bg-white pb-12 pt-8 sm:pb-16 sm:pt-12">
      <div className="shell-wide">
        <nav aria-label="업종별 채용정보" className="mx-auto grid max-w-[1080px] grid-cols-5 gap-2 sm:gap-3 lg:grid-cols-10">
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
