import { createClient } from '@/lib/supabase/client';
import type { Quotation, QuotationItem, QuotationStatus } from '@/types/database';
import type { QuotationCreateInput, QuotationFilters, QuotationItemInput, QuotationUpdateInput } from '../types';

const QUOTATION_WITH_RELATIONS = `
  *,
  items:quotation_items(*),
  sender:profiles!sender_profile_id(id, company_name, contact_name, profile_image, verification_status),
  receiver:profiles!receiver_profile_id(id, company_name, contact_name, profile_image, verification_status)
`;

const ERROR_MAP: Record<string, string> = {
  unauthorized: '로그인이 필요합니다.',
  quotation_not_found: '견적을 찾을 수 없습니다.',
  only_sender_can_send: '견적 작성자만 발송할 수 있습니다.',
  only_sender_can_cancel: '견적 작성자만 취소할 수 있습니다.',
  only_receiver_can_accept: '수신자만 승인할 수 있습니다.',
  only_receiver_can_reject: '수신자만 거절할 수 있습니다.',
  only_receiver_can_view: '수신자만 열람 처리 가능합니다.',
  quotation_not_accepted: '승인된 견적만 계약으로 전환할 수 있습니다.',
  not_party_to_quotation: '거래 당사자만 가능합니다.',
  contract_already_exists: '이미 계약이 생성된 견적입니다.',
};

function translateQuotationError(message: string): string {
  for (const [code, kr] of Object.entries(ERROR_MAP)) {
    if (message.includes(code)) return kr;
  }
  if (message.includes('invalid_transition_from')) return '현재 상태에서는 변경할 수 없습니다.';
  if (message.includes('unknown_target_status')) return '잘못된 상태 변경 요청입니다.';
  return message;
}

export const quotationService = {
  /**
   * 내 받은/보낸 견적 목록.
   * RLS가 sender/receiver 양 당사자만 SELECT 허용하므로 클라이언트 측 추가 가드 불필요.
   */
  async list(
    profileId: string,
    filters: QuotationFilters = {},
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Quotation[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('quotations')
      .select(QUOTATION_WITH_RELATIONS, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.direction === 'sent') {
      query = query.eq('sender_profile_id', profileId);
    } else if (filters.direction === 'received') {
      query = query.eq('receiver_profile_id', profileId);
    } else {
      query = query.or(`sender_profile_id.eq.${profileId},receiver_profile_id.eq.${profileId}`);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.ilike('title', `%${filters.search.replace(/[,%_]/g, ' ').trim()}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(translateQuotationError(error.message));
    return {
      data: (data ?? []) as unknown as Quotation[],
      count: count ?? 0,
    };
  },

  async getById(id: string): Promise<Quotation | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('quotations')
      .select(QUOTATION_WITH_RELATIONS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(translateQuotationError(error.message));
    return (data ?? null) as Quotation | null;
  },

  /**
   * 견적 신규 작성 — draft 상태로 저장. 발송은 transitionStatus('sent')로 별도 호출.
   * 라인 아이템도 함께 insert. 라인 아이템 변경 시 trigger가 quotations.subtotal/tax/total 자동 재계산.
   */
  async create(profileId: string, input: QuotationCreateInput): Promise<Quotation> {
    const supabase = createClient();

    const { data: quotation, error } = await supabase
      .from('quotations')
      .insert({
        sender_profile_id: profileId,
        receiver_profile_id: input.receiver_profile_id,
        conversation_id: input.conversation_id ?? null,
        title: input.title,
        description: input.description ?? null,
        event_date: input.event_date ?? null,
        event_venue: input.event_venue ?? null,
        valid_until: input.valid_until ?? null,
        internal_note: input.internal_note ?? null,
        status: 'draft',
      })
      .select('*')
      .single();

    if (error || !quotation) throw new Error(translateQuotationError(error?.message ?? '견적 작성 실패'));

    if (input.items.length > 0) {
      const rows = input.items.map((item, idx) => ({
        quotation_id: quotation.id,
        position: idx,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        note: item.note ?? null,
      }));
      const { error: itemsError } = await supabase.from('quotation_items').insert(rows);
      if (itemsError) {
        // 견적 본체 롤백 (soft delete)
        await supabase.from('quotations').update({ deleted_at: new Date().toISOString() }).eq('id', quotation.id);
        throw new Error(translateQuotationError(itemsError.message));
      }
    }

    return (await this.getById(quotation.id))!;
  },

  /**
   * 견적 본체 수정 — draft 상태에서만 허용 (RLS 가드).
   */
  async update(id: string, input: QuotationUpdateInput): Promise<Quotation> {
    const supabase = createClient();
    const { error } = await supabase
      .from('quotations')
      .update({
        title: input.title,
        description: input.description ?? null,
        event_date: input.event_date ?? null,
        event_venue: input.event_venue ?? null,
        valid_until: input.valid_until ?? null,
        internal_note: input.internal_note ?? null,
      })
      .eq('id', id)
      .eq('status', 'draft');

    if (error) throw new Error(translateQuotationError(error.message));
    return (await this.getById(id))!;
  },

  /**
   * 라인 아이템 일괄 교체 (draft 상태에서만).
   * 가장 단순한 동기화 패턴 — 기존 항목 삭제 후 새로 insert.
   */
  async replaceItems(quotationId: string, items: QuotationItemInput[]): Promise<QuotationItem[]> {
    const supabase = createClient();
    const { error: delError } = await supabase
      .from('quotation_items')
      .delete()
      .eq('quotation_id', quotationId);
    if (delError) throw new Error(translateQuotationError(delError.message));

    if (items.length === 0) return [];
    const rows = items.map((item, idx) => ({
      quotation_id: quotationId,
      position: idx,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      note: item.note ?? null,
    }));
    const { data, error } = await supabase.from('quotation_items').insert(rows).select('*');
    if (error) throw new Error(translateQuotationError(error.message));
    return (data ?? []) as QuotationItem[];
  },

  /**
   * 상태 전이 — RPC 호출. DB 측 권한 가드 적용.
   */
  async transitionStatus(id: string, toStatus: QuotationStatus, reason?: string): Promise<Quotation> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('transition_quotation_status', {
      p_quotation_id: id,
      p_to_status: toStatus,
      p_reason: reason ?? null,
    });
    if (error) throw new Error(translateQuotationError(error.message));
    return data as Quotation;
  },

  /**
   * 견적 → 계약 자동 생성. accepted 견적만.
   */
  async createContract(
    quotationId: string,
    eventDate: string,
    paymentTerms?: string,
    cancellationTerms?: string,
  ): Promise<{ contract_id: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_contract_from_quotation', {
      p_quotation_id: quotationId,
      p_event_date: eventDate,
      p_payment_terms: paymentTerms ?? null,
      p_cancellation_terms: cancellationTerms ?? null,
    });
    if (error) throw new Error(translateQuotationError(error.message));
    return { contract_id: (data as { id: string }).id };
  },

  /**
   * 견적 소프트 삭제 (draft만).
   */
  async softDelete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('quotations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'draft');
    if (error) throw new Error(translateQuotationError(error.message));
  },

  /**
   * 받은 견적 자동 'viewed' 처리.
   * receiver가 처음 상세 페이지 진입 시 호출.
   */
  async markViewedIfNeeded(quotation: Quotation, profileId: string): Promise<void> {
    if (
      quotation.status === 'sent' &&
      quotation.receiver_profile_id === profileId
    ) {
      try {
        await this.transitionStatus(quotation.id, 'viewed');
      } catch {
        // 실패해도 silent — 열람 표시는 비핵심
      }
    }
  },
};
