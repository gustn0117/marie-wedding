'use client';

import type { QuotationItemInput } from '../types';

export default function QuotationItemsEditor({
  items,
  onChange,
}: {
  items: QuotationItemInput[];
  onChange: (items: QuotationItemInput[]) => void;
}) {
  const update = (idx: number, patch: Partial<QuotationItemInput>) => {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    onChange(next);
  };
  const add = () => onChange([...items, { description: '', quantity: 1, unit_price: 0, note: '' }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const next = items.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  // 클라이언트 측 미리보기 합계 (서버 트리거가 실제 저장 시 재계산)
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-10">#</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">항목 *</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-24">수량</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-32">단가</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-32">금액</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-500 text-xs uppercase tracking-wider w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                  항목을 추가해 주세요.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const lineTotal = item.quantity * item.unit_price;
                return (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => update(idx, { description: e.target.value })}
                        placeholder="예: 본식 사회 진행"
                        className="w-full px-2 py-1 text-sm border border-transparent rounded focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                      />
                      <input
                        type="text"
                        value={item.note ?? ''}
                        onChange={(e) => update(idx, { note: e.target.value })}
                        placeholder="메모 (선택)"
                        className="w-full mt-0.5 px-2 py-0.5 text-xs text-gray-500 border border-transparent rounded focus:border-gray-300 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-sm text-right tabular-nums border border-transparent rounded focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => update(idx, { unit_price: Number(e.target.value) })}
                        className="w-full px-2 py-1 text-sm text-right tabular-nums border border-transparent rounded focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-ink font-semibold tabular-nums">{fmt(lineTotal)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          aria-label="위로 이동"
                          className="w-6 h-6 inline-flex items-center justify-center rounded text-gray-400 hover:text-ink hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(idx, 1)}
                          disabled={idx === items.length - 1}
                          aria-label="아래로 이동"
                          className="w-6 h-6 inline-flex items-center justify-center rounded text-gray-400 hover:text-ink hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          aria-label="삭제"
                          className="w-6 h-6 inline-flex items-center justify-center rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-sm text-gray-600">소계</td>
              <td className="px-3 py-2 text-right text-sm font-semibold text-ink tabular-nums">{fmt(subtotal)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-sm text-gray-600">VAT 10%</td>
              <td className="px-3 py-2 text-right text-sm font-semibold text-ink tabular-nums">{fmt(tax)}</td>
              <td></td>
            </tr>
            <tr className="border-t border-gray-200">
              <td colSpan={4} className="px-3 py-2 text-right text-sm font-bold text-ink">총액 (KRW)</td>
              <td className="px-3 py-2 text-right text-base font-bold text-primary tabular-nums">{fmt(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button
        type="button"
        onClick={add}
        className="w-full py-2.5 text-sm font-bold text-ink border-2 border-dashed border-gray-300 rounded-xl hover:border-ink hover:bg-gray-50 transition-colors"
      >
        + 항목 추가
      </button>
    </div>
  );
}
