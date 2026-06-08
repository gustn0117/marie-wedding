import type { QuotationItem } from '@/types/database';

export default function QuotationItemsTable({
  items,
  subtotal,
  tax,
  total,
  currency = 'KRW',
}: {
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency?: string;
}) {
  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider w-12">#</th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">항목</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-20">수량</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-32">단가</th>
            <th className="px-4 py-2.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wider w-36">금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">항목이 없습니다</td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr key={item.id}>
                <td className="px-4 py-3 text-gray-400 tabular-nums">{idx + 1}</td>
                <td className="px-4 py-3">
                  <p className="text-ink font-medium">{item.description}</p>
                  {item.note && <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{fmt(item.quantity)}</td>
                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{fmt(item.unit_price)}</td>
                <td className="px-4 py-3 text-right text-ink font-semibold tabular-nums">{fmt(item.line_total)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot className="bg-gray-50 border-t border-gray-200">
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right text-sm text-gray-600">소계</td>
            <td className="px-4 py-2 text-right text-sm font-semibold text-ink tabular-nums">{fmt(subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right text-sm text-gray-600">부가세 (VAT 10%)</td>
            <td className="px-4 py-2 text-right text-sm font-semibold text-ink tabular-nums">{fmt(tax)}</td>
          </tr>
          <tr className="border-t border-gray-200">
            <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-ink">총액 ({currency})</td>
            <td className="px-4 py-3 text-right text-lg font-extrabold text-primary tabular-nums">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
