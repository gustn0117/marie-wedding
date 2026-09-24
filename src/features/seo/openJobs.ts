import { createServerQueryClient } from '@/lib/supabase/server-query';
import { PUBLIC_JOB_COLUMNS } from '@/shared/constants/jobSelect';
import { PUBLIC_PROFILE_COLUMNS } from '@/shared/constants/profileSelect';
import type { BusinessType } from '@/shared/constants';
import type { Job } from '@/types/database';

/**
 * 채용정보 목록과 같은 기준의 '모집 중' 공고(삭제·숨김·마감·충원·마감일 경과 제외), 최신순.
 * 가이드 페이지와 /llms.txt 가 쓴다. 조회 실패 시 빈 배열(호출 페이지는 그대로 뜬다).
 */
export async function getOpenJobs({ businessTypes = [], limit }: { businessTypes?: readonly BusinessType[]; limit: number }): Promise<Job[]> {
  const supabase = createServerQueryClient();
  let query = supabase
    .from('jobs')
    .select(`${PUBLIC_JOB_COLUMNS}, author:profiles!author_id(${PUBLIC_PROFILE_COLUMNS})`)
    .is('deleted_at', null)
    .eq('hidden_by_admin', false)
    .eq('posting_type', 'hiring')
    .not('status', 'in', '(hidden,filled,closed)')
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`);
  if (businessTypes.length > 0) query = query.in('business_type', [...businessTypes]);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) {
    console.error('[seo] open jobs query failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as Job[];
}
