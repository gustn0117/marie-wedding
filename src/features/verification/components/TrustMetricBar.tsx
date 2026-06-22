interface Props {
  label: string;
  value: string;
  sub?: string;
  fillPercent?: number; // 0-100, optional progress bar
  emphasis?: boolean;
}

export default function TrustMetricBar({ label, value, sub, fillPercent, emphasis }: Props) {
  const safePct = typeof fillPercent === 'number' ? Math.max(0, Math.min(100, fillPercent)) : null;
  return (
    <div className={`p-4 md:p-5 rounded-lg border ${emphasis ? 'border-ink' : 'border-gray-200'} bg-white`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
      <p className={`text-[22px] md:text-2xl font-bold leading-none ${emphasis ? 'text-primary' : 'text-gray-900'}`}>{value}</p>
      {safePct !== null && (
        <div className="mt-3 h-1 bg-gray-100 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${emphasis ? 'bg-ink' : 'bg-gray-700'}`}
            style={{ width: `${safePct}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-2 text-[11.5px] text-gray-400 leading-relaxed">{sub}</p>}
    </div>
  );
}
