import type { QuotationStatus } from '@/types/database';

export type QuotationDirection = 'sent' | 'received';

export interface QuotationFilters {
  direction?: QuotationDirection;
  status?: QuotationStatus;
  search?: string;
}

export interface QuotationItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  note?: string | null;
}

export interface QuotationCreateInput {
  receiver_profile_id: string;
  conversation_id?: string | null;
  title: string;
  description?: string | null;
  event_date?: string | null;
  event_venue?: string | null;
  valid_until?: string | null;
  items: QuotationItemInput[];
  internal_note?: string | null;
}

export interface QuotationUpdateInput {
  title?: string;
  description?: string | null;
  event_date?: string | null;
  event_venue?: string | null;
  valid_until?: string | null;
  internal_note?: string | null;
}
