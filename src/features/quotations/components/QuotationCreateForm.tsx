'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { quotationService } from '../services/quotation-service';
import type { QuotationItemInput } from '../types';
import QuotationItemsEditor from './QuotationItemsEditor';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { notify } from '@/features/notifications/lib/dispatch';

interface ReceiverOption {
  id: string;
  label: string;
}

export default function QuotationCreateForm({
  senderProfileId,
  defaultReceiverId,
  defaultConversationId,
}: {
  senderProfileId: string;
  defaultReceiverId?: string;
  defaultConversationId?: string;
}) {
  const router = useRouter();
  const [receiverId, setReceiverId] = useState(defaultReceiverId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [items, setItems] = useState<QuotationItemInput[]>([
    { description: '', quantity: 1, unit_price: 0, note: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 수신자 검색 — 디렉토리에서 자동완성
  const [receiverSearch, setReceiverSearch] = useState('');
  const [receiverOptions, setReceiverOptions] = useState<ReceiverOption[]>([]);
  const [receiverLabel, setReceiverLabel] = useState('');

  useEffect(() => {
    if (defaultReceiverId) {
      // 미리 받은 id가 있으면 라벨 가져오기
      const supabase = createClient();
      supabase
        .from('profiles')
        .select('id, company_name, contact_name')
        .eq('id', defaultReceiverId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setReceiverLabel(data.company_name || data.contact_name || '');
        });
    }
  }, [defaultReceiverId]);

  useEffect(() => {
    if (!receiverSearch || receiverSearch.length < 2) {
      setReceiverOptions([]);
      return;
    }
    const handler = setTimeout(async () => {
      const supabase = createClient();
      const term = receiverSearch.replace(/[,%_]/g, ' ').trim();
      const { data } = await supabase
        .from('profiles')
        .select('id, company_name, contact_name, business_type, region')
        .is('deleted_at', null)
        .eq('is_directory_listed', true)
        .neq('id', senderProfileId)
        .or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%`)
        .limit(10);
      setReceiverOptions(
        (data ?? []).map((p) => ({
          id: p.id,
          label: `${p.company_name || p.contact_name}${p.business_type ? ` · ${p.business_type.split(',')[0]}` : ''}`,
        }))
      );
    }, 250);
    return () => clearTimeout(handler);
  }, [receiverSearch, senderProfileId]);

  const handleSubmit = async (e: React.FormEvent, sendNow: boolean) => {
    e.preventDefault();
    setError(null);
    if (!receiverId) { setError('수신자를 선택해 주세요.'); return; }
    if (!title.trim()) { setError('견적 제목을 입력해 주세요.'); return; }
    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) { setError('최소 1개의 항목을 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      const created = await quotationService.create(senderProfileId, {
        receiver_profile_id: receiverId,
        conversation_id: defaultConversationId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        event_date: eventDate || null,
        event_venue: eventVenue.trim() || null,
        valid_until: validUntil || null,
        internal_note: internalNote.trim() || null,
        items: validItems,
      });

      if (sendNow) {
        // 발송까지 한 번에
        await quotationService.transitionStatus(created.id, 'sent');
        notify.quotationSent(created.id);
        toast('견적을 작성하고 발송했습니다.', 'success');
      } else {
        toast('견적 초안을 저장했습니다.', 'success');
      }
      router.push(ROUTES.QUOTATIONS_DETAIL(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적 작성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {/* 수신자 */}
      <Section title="수신자" required>
        {receiverId && receiverLabel ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 text-primary border border-primary-200 text-sm font-bold">
              {receiverLabel}
            </span>
            <button
              type="button"
              onClick={() => { setReceiverId(''); setReceiverLabel(''); setReceiverSearch(''); }}
              className="text-xs text-gray-500 hover:text-rose-600"
            >
              변경
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={receiverSearch}
              onChange={(e) => setReceiverSearch(e.target.value)}
              placeholder="업체명/담당자명 검색 (2자 이상)"
              className="input"
            />
            {receiverOptions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                {receiverOptions.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiverId(opt.id);
                        setReceiverLabel(opt.label);
                        setReceiverOptions([]);
                        setReceiverSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-gray-50"
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* 기본 정보 */}
      <Section title="기본 정보" required>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="견적 제목 (예: 6월 본식 사회 진행 견적)"
            maxLength={120}
            required
            className="input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="상세 설명 (선택)"
            rows={3}
            className="input resize-none"
          />
        </div>
      </Section>

      {/* 예식 정보 */}
      <Section title="예식 정보">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">예식 일자</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">예식 장소</label>
            <input type="text" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="예: 강남 OO 컨벤션" className="input" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">견적 유효 기한</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
          </div>
        </div>
      </Section>

      {/* 라인 항목 */}
      <Section title="견적 항목" required>
        <QuotationItemsEditor items={items} onChange={setItems} />
      </Section>

      {/* 내부 메모 */}
      <Section title="내부 메모">
        <textarea
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          placeholder="상대방에게는 보이지 않는 나만의 메모"
          rows={2}
          className="input resize-none"
        />
      </Section>

      {/* 액션 */}
      <div className="sticky bottom-4 rounded-xl border border-gray-200 bg-white p-4 shadow-md flex flex-wrap justify-end gap-2">
        <Link href={ROUTES.QUOTATIONS} className="btn-outline text-sm">취소</Link>
        <button type="submit" disabled={submitting} className="btn-outline text-sm">
          {submitting ? '저장 중...' : '초안 저장'}
        </button>
        <button type="button" onClick={(e) => handleSubmit(e as React.FormEvent, true)} disabled={submitting} className="btn-primary text-sm">
          {submitting ? '저장+발송 중...' : '저장하고 발송'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-ink mb-2.5">
        {title}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </h2>
      {children}
    </section>
  );
}
