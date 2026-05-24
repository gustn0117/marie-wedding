interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export default function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="filter-chip">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 -mr-1 p-0.5 hover:bg-primary/10 rounded-sm"
        aria-label={`${label} 필터 제거`}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
