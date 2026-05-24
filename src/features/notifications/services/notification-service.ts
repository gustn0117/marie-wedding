import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types/database';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data ?? []) as Notification[];
  },

  async markRead(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllRead(): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .is('deleted_at', null);
    if (error) throw error;
  },
};
