'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/database';
import { messageService } from '@/features/messages/services/messageService';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';

interface Props {
  conversationId: string;
  myProfileId: string;
  partnerName: string;
  initialMessages: Message[];
}

export default function MessageThread({ conversationId, myProfileId, partnerName, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageService.markRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const msg = await withTimeout(messageService.send(conversationId, text), 10000);
      setMessages((prev) => [...prev, msg]);
      setBody('');
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('초과') ? '전송이 너무 오래 걸려요. 다시 시도해주세요.' : '전송에 실패했습니다.';
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      <header className="px-4 py-3 border-b border-gray-200">
        <p className="text-sm font-bold text-gray-900">{partnerName}</p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">아직 쪽지가 없습니다. 첫 쪽지를 보내보세요.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myProfileId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-3 py-2 text-sm rounded ${mine ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={onSend} className="border-t border-gray-200 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="쪽지를 입력하세요…"
          maxLength={2000}
          disabled={busy}
          className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="btn-primary px-5 disabled:opacity-50"
        >
          {busy ? '전송 중…' : '보내기'}
        </button>
      </form>
    </div>
  );
}
