import { createClient } from '@/lib/supabase/client';
import type { Settlement, SettlementStatus } from '@/types/database';

const SETTLEMENT_WITH_RELATIONS = `
  *,
  contract:contracts(id, title, event_date, party_a_org_name, party_b_org_name, party_a_profile_id, party_b_profile_id),
  payee:profiles!payee_profile_id(id, company_name, contact_name, profile_image)
`;

const ERROR_MAP: Record<string, string> = {
  unauthorized: '로그인이 필요합니다.',
  admin_only: '관리자만 가능합니다.',
  not_authorized: '권한이 없습니다.',
  not_party_to_contract: '계약 당사자만 가능합니다.',
  contract_not_found: '계약을 찾을 수 없습니다.',
  contract_not_completed: '완료된 계약만 정산할 수 있습니다.',
  settlement_not_found: '정산 정보를 찾을 수 없습니다.',
  settlement_already_exists: '이미 정산이 등록된 계약입니다.',
};

function translateError(message: string): string {
  for (const [code, kr] of Object.entries(ERROR_MAP)) {
    if (message.includes(code)) return kr;
  }
  if (message.includes('invalid_status_for_')) return '현재 상태에서는 이 작업을 할 수 없습니다.';
  return message;
}

export interface SettlementFilters {
  status?: SettlementStatus;
  payeeId?: string;
  search?: string;
}

export const settlementService = {
  async list(filters: SettlementFilters = {}, page = 1, pageSize = 20): Promise<{ data: Settlement[]; count: number }> {
    const supabase = createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('settlements')
      .select(SETTLEMENT_WITH_RELATIONS, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.payeeId) query = query.eq('payee_profile_id', filters.payeeId);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error, count } = await query;
    if (error) throw new Error(translateError(error.message));
    return { data: (data ?? []) as unknown as Settlement[], count: count ?? 0 };
  },

  async getById(id: string): Promise<Settlement | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('settlements')
      .select(SETTLEMENT_WITH_RELATIONS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(translateError(error.message));
    return (data ?? null) as Settlement | null;
  },

  async createFromContract(contractId: string, payeeSide: 'party_a' | 'party_b' = 'party_b'): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_settlement_from_contract', {
      p_contract_id: contractId,
      p_payee_side: payeeSide,
      p_fee_rate_override: null,
    });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },

  async approve(id: string, scheduledAt?: string): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('approve_settlement', {
      p_settlement_id: id,
      p_scheduled_at: scheduledAt ?? null,
    });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },

  async process(id: string, options: { method?: string; account?: string; reference?: string } = {}): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('process_settlement', {
      p_settlement_id: id,
      p_payout_method: options.method ?? 'bank_transfer',
      p_payout_account: options.account ?? null,
      p_payout_reference: options.reference ?? null,
    });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },

  async markPaid(id: string, reference?: string): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('mark_settlement_paid', {
      p_settlement_id: id,
      p_payout_reference: reference ?? null,
    });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },

  async fail(id: string, reason: string): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fail_settlement', { p_settlement_id: id, p_reason: reason });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },

  async cancel(id: string): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('cancel_settlement', { p_settlement_id: id });
    if (error) throw new Error(translateError(error.message));
    return data as Settlement;
  },
};
