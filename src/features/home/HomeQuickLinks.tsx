import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { PARTNER_URL } from '@/shared/constants/siteMenu';

interface QuickLink {
  title: string;
  desc: string;
  href: string;
  external?: boolean;
  /** 정사각 썸네일 — public/ 기준 경로 */
  image: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: '공고 등록',
    desc: '업체 회원은 무료로 채용공고를 올릴 수 있어요.',
    href: ROUTES.JOBS_NEW,
    image: '/images/home/quick-job.webp',
  },
  {
    title: '프로필 등록',
    desc: '프로필을 등록하고 새로운 일을 만나보세요.',
    href: ROUTES.DIRECTORY_REGISTER,
    image: '/images/home/quick-profile.webp',
  },
  {
    title: '웨딩 컨시어지',
    desc: '예식도우미가 필요할 때 바로 연결해 드려요.',
    href: PARTNER_URL,
    external: true,
    image: '/images/home/quick-concierge.webp',
  },
];

/** 메인 배너 아래에 걸쳐 올라가는 바로가기 3칸 */
export default function HomeQuickLinks() {
  return (
    <div className="shell-wide relative z-10 -mt-12 sm:-mt-16">
      <ul className="grid bg-gray-100 md:grid-cols-3 md:py-6 lg:py-7">
        {QUICK_LINKS.map((q, i) => (
          <li key={q.title} className={i > 0 ? 'border-t border-gray-200 md:border-l md:border-t-0' : undefined}>
            <QuickLinkItem item={q} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickLinkItem({ item }: { item: QuickLink }) {
  const body = (
    <>
      <span className="relative h-16 w-16 shrink-0 overflow-hidden md:h-14 md:w-14 lg:h-20 lg:w-20 xl:h-[104px] xl:w-[104px]">
        <Image src={item.image} alt="" fill sizes="104px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 break-keep text-[16px] font-bold text-ink underline-offset-4 group-hover:underline lg:text-[17px] xl:text-[19px]">
          {item.title}
          {item.external && (
            <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          )}
        </span>
        <span className="mt-1.5 line-clamp-2 break-keep text-[13px] leading-relaxed text-gray-500 xl:text-[15px]">
          {item.desc}
        </span>
      </span>
    </>
  );

  // md: 칸이 좁아 썸네일을 위로, lg 부터 레퍼런스처럼 가로 배치
  const className = 'group flex items-center gap-4 px-5 py-5 md:flex-col md:items-start md:gap-3 md:py-1 lg:flex-row lg:items-center lg:gap-5 lg:px-7 xl:gap-6 xl:px-10';
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {body}
    </Link>
  );
}
