'use client';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  options: readonly FilterOption[] | FilterOption[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}

export default function FilterSelect({
  label,
  options,
  value,
  onChange,
  allLabel = '전체',
}: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full min-w-[120px] px-4 py-2.5 pr-10 bg-white border border-border rounded-lg text-sm text-text-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary transition-colors duration-200"
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
