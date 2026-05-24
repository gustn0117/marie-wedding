import { createClient } from '@/lib/supabase/client';
import type { Bookmark, BookmarkTargetType } from '@/types/database';

export const bookmarkService = {
  async getBookmark(
    profileId: string,
    targetType: BookmarkTargetType,
    targetId: string,
  ): Promise<Bookmark | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('profile_id', profileId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();

    if (error) throw error;
    return data as Bookmark | null;
  },

  async toggleBookmark(
    profileId: string,
    targetType: BookmarkTargetType,
    targetId: string,
  ): Promise<{ saved: boolean }> {
    const supabase = createClient();
    const { data: existing, error: lookupError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('profile_id', profileId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { saved: false };
    }

    const { error } = await supabase
      .from('bookmarks')
      .insert({ profile_id: profileId, target_type: targetType, target_id: targetId });
    if (error) throw error;
    return { saved: true };
  },
};
