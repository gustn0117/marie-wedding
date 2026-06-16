'use client';

import { createClient } from '@/lib/supabase/client';
import type { Review, ReviewTag } from '@/types/database';

export const reviewService = {
  async listActiveTags(): Promise<ReviewTag[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('review_tags')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ReviewTag[];
  },

  async submit(applicationId: string, tagIds: string[]): Promise<Review> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('submit_review', {
      p_application_id: applicationId,
      p_tag_ids: tagIds,
    });
    if (error) throw error;
    return data as Review;
  },

  async listForReviewee(revieweeId: string, limit = 20, offset = 0): Promise<Review[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviewer_id(*)')
      .eq('reviewee_id', revieweeId)
      .eq('is_public', true)
      .eq('is_hidden_by_admin', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []) as Review[];
  },

  async getByApplication(applicationId: string, reviewerId: string): Promise<Review | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('application_id', applicationId)
      .eq('reviewer_id', reviewerId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as Review | null;
  },
};

export function reviewErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('deal_not_completed')) return '양쪽 모두 진행 완료 처리 후에 리뷰를 작성할 수 있습니다.';
  if (msg.includes('review_window_closed')) return '리뷰 작성 기한(30일)이 지났습니다.';
  if (msg.includes('not_party_to_application')) return '해당 지원의 당사자만 리뷰를 작성할 수 있습니다.';
  if (msg.includes('duplicate key value') || msg.includes('idx_reviews_application_direction')) {
    return '이미 리뷰를 작성하셨습니다.';
  }
  if (msg.includes('invalid_tag_count')) return '태그는 1개 이상 5개 이하로 선택해 주세요.';
  if (msg.includes('invalid_tag')) return '유효하지 않은 태그가 포함되어 있습니다.';
  return '리뷰 작성에 실패했습니다.';
}
