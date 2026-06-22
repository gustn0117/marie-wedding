import { JOB_SECTIONS, parseSections, type JobSectionKey } from '@/features/jobs/lib/parse-job-description';
import RichTextView from '@/shared/components/RichTextView';

interface Props {
  html: string;
}

/**
 * 공고 상세 페이지의 description을 5개 섹션 카드로 표시.
 *
 * - 저장된 HTML을 parseSections로 분해
 * - 헤더 인식 성공 시: 섹션별 카드(아이콘 + 제목 + 본문). 빈 섹션은 자동 숨김
 * - 헤더 인식 실패(자유형식)면 기존 RichTextView로 폴백
 */
export default function JobDescriptionView({ html }: Props) {
  const { sections, fallbackUsed } = parseSections(html);

  if (fallbackUsed || !html?.trim()) {
    return <RichTextView html={html ?? ''} className="text-[15px] text-gray-700 leading-relaxed" />;
  }

  const filled = JOB_SECTIONS.filter((s) => sections[s.key].trim().length > 0);
  if (filled.length === 0) {
    return <RichTextView html={html} className="text-[15px] text-gray-700 leading-relaxed" />;
  }

  return (
    <div className="space-y-5">
      {filled.map((sec, idx) => (
        <SectionCard
          key={sec.key}
          index={idx + 1}
          sectionKey={sec.key}
          title={sec.title}
          body={sections[sec.key]}
        />
      ))}
    </div>
  );
}

function SectionCard({
  index,
  sectionKey,
  title,
  body,
}: {
  index: number;
  sectionKey: JobSectionKey;
  title: string;
  body: string;
}) {
  return (
    <article className="flex gap-4">
      {/* 좌측: 번호 + 세로 라인 */}
      <div className="flex flex-col items-center shrink-0">
        <span
          className="w-8 h-8 rounded-full bg-ink text-white text-[12px] font-bold inline-flex items-center justify-center"
          aria-hidden
        >
          {String(index).padStart(2, '0')}
        </span>
        <span className="flex-1 w-px bg-gray-200 mt-2" aria-hidden />
      </div>

      {/* 우측: 헤더 + 본문 */}
      <div className="flex-1 min-w-0 pb-2">
        <header className="flex items-center gap-2 mb-3">
          <SectionIcon sectionKey={sectionKey} />
          <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        </header>
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-5 py-4">
          <SectionBody text={body} />
        </div>
      </div>
    </article>
  );
}

function SectionBody({ text }: { text: string }) {
  // 줄 단위 분해 — '- ', '· ', '• ' 같은 글머리 기호로 시작하면 bullet item으로
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const isBulletish = lines.every((l) => /^[-·•▪▶◆※*]/.test(l)) && lines.length >= 2;

  if (isBulletish) {
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-[14.5px] text-gray-700 leading-relaxed">
            <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-ink/60" aria-hidden />
            <span className="min-w-0">{line.replace(/^[-·•▪▶◆※*]\s*/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <p key={i} className="text-[14.5px] text-gray-700 leading-relaxed">{line}</p>
      ))}
    </div>
  );
}

function SectionIcon({ sectionKey }: { sectionKey: JobSectionKey }) {
  const paths: Record<JobSectionKey, string> = {
    duty:
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    requirements:
      'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
    conditions:
      'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
    apply:
      'M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5',
    extra:
      'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  };
  return (
    <svg
      className="w-4 h-4 text-gray-500 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[sectionKey]} />
    </svg>
  );
}
