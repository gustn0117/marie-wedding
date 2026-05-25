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
    <div className={`p-3 border ${emphasis ? 'border-black' : 'border-gray-200'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold leading-none ${emphasis ? 'text-gray-950' : 'text-gray-900'}`}>{value}</p>
      {safePct !== null && (
        <div className="mt-2 h-1 bg-gray-100 overflow-hidden">
          <div
            className={`h-full transition-all ${emphasis ? 'bg-gray-900' : 'bg-gray-700'}`}
            style={{ width: `${safePct}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-1 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
