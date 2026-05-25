'use client';

import { createClient } from '@/lib/supabase/client';
import type { Conversation, Message } from '@/types/database';

export const messageService = {
  async startConversation(otherProfileId: string): Promise<Conversation> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('start_conversation', { p_other_profile_id: otherProfileId });
    if (error) throw error;
    return data as Conversation;
  },

  async send(conversationId: string, body: string): Promise<Message> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('send_message', {
      p_conversation_id: conversationId,
      p_body: body,
    });
    if (error) throw error;
    return data as Message;
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Message[];
  },

  async markRead(conversationId: string, profileId: string): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', profileId)
      .is('read_at', null);
  },
};
