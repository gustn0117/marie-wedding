import { createServiceClient } from '@/lib/supabase/service';
import { formatRelativeTime } from '@/shared/utils/format';
import InquiryStatusToggle from './InquiryStatusToggle';

export const dynamic = 'force-dynamic';

export const metadata = { title: '고객 문의 | Marié Admin' };

interface Inquiry {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string;
  status: string;
  created_at: string;
}

export default async function AdminInquiriesPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('support_inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  const items = (data ?? []) as Inquiry[];
  const openCount = items.filter((i) => i.status !== 'resolved').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">고객 문의</h1>
        <p className="mt-1 text-sm text-gray-500">고객센터로 접수된 문의입니다. 총 {items.length}건 · 대기 {openCount}건</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-400">접수된 문의가 없습니다.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3 whitespace-nowrap">접수일</th>
                <th className="px-4 py-3 whitespace-nowrap">이름</th>
                <th className="px-4 py-3 whitespace-nowrap">연락처</th>
                <th className="px-4 py-3">문의 내용</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((it) => (
                <tr key={it.id} className={it.status === 'resolved' ? 'bg-gray-50/50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 align-top">{formatRelativeTime(it.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-800 align-top">{it.name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 align-top">
                    {it.phone && <div className="tabular-nums">{it.phone}</div>}
                    {it.email && <div className="break-all">{it.email}</div>}
                    {!it.phone && !it.email && '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 align-top">
                    <p className="whitespace-pre-wrap break-words max-w-[420px]">{it.message}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center align-top">
                    <InquiryStatusToggle id={it.id} status={it.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
