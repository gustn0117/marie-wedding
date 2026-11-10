'use client';

interface ChipOption {
  value: string;
  label: string;
}

interface AppSelectChipProps {
  /** 아무것도 안 골랐을 때 칩 글자 */
  label: string;
  /** 화면 읽기 이름 — 없으면 label */
  ariaLabel?: string;
  value: string;
  options: readonly ChipOption[];
  onChange: (value: string) => void;
  /** 목록 맨 위 '전체' 항목 글자 — options 에 빈 값('')이 이미 있으면 따로 넣지 않는다 */
  allLabel?: string;
}

/**
 * 앱 필터 칩 — 누르면 iOS 기본 선택 메뉴가 뜬다(투명한 <select> 를 칩 위에 덮음).
 * 하나만 고르는 필터(고용형태·급여·경력·정렬)에 쓴다. 고른 값이 있으면 칩이 남색으로 채워진다(.app-chip[data-on]).
 */
export default function AppSelectChip({ label, ariaLabel, value, options, onChange, allLabel }: AppSelectChipProps) {
  const selected = value ? options.find((o) => o.value === value) : undefined;
  const hasEmptyOption = options.some((o) => o.value === '');

  return (
    <label data-on={!!selected} className="app-chip">
      <span>{selected ? selected.label : label}</span>
      <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
      <select
        aria-label={ariaLabel ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-[16px] opacity-0"
      >
        {!hasEmptyOption && <option value="">{allLabel ?? `${label} 전체`}</option>}
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
