import { createClient } from '@/lib/supabase/client';
import type { Report, ReportTargetType } from '@/types/database';

export const reportService = {
  async createReport(input: {
    reporterId: string | null;
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    details?: string;
  }): Promise<Report> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: input.reporterId,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        details: input.details?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Report;
  },
};
