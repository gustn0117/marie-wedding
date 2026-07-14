'use client';

import { createClient } from '@/lib/supabase/client';
import { apiFetch } from '@/shared/utils/apiFetch';
import type { Conversation, Message } from '@/types/database';

export const messageService = {
  // 대화 시작/전송은 서버 라우트(쿠키 세션)로 처리 — 클라 세션 토큰 지연·누락으로
  // auth.uid() 가 NULL 이 되어 'unauthorized' 로 실패/지연하던 문제 회피.
  async startConversation(otherProfileId: string): Promise<Conversation> {
    const res = await apiFetch('/api/messages/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetProfileId: otherProfileId }),
    }, 10000);
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || '대화 시작에 실패했습니다.');
    }
    const { data } = await res.json();
    return data as Conversation;
  },

  async send(conversationId: string, body: string): Promise<Message> {
    const res = await apiFetch('/api/messages/send', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, body }),
    }, 10000);
    if (!res.ok) {
      const b = await res.json().catch(() => ({ error: '' }));
      throw new Error(b.error || '메시지 전송에 실패했습니다.');
    }
    const { data } = await res.json();
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
