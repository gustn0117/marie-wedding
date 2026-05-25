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

  async markRead(conversationId: string): Promise<void> {
    const supabase = createClient();
    await supabase.rpc('mark_messages_read', { p_conversation_id: conversationId });
  },
};
