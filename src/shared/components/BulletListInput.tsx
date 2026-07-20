'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 줄 단위 목록 입력기 — 각 줄이 강제로 하나의 * 항목이 된다.
 * Enter=새 항목, 빈 항목에서 Backspace=삭제. 자유 문단/서식/이미지는 불가.
 * value/onChange 는 `<ul><li>..</li></ul>` HTML 로 주고받아 저장·파싱 로직과 호환된다.
 */
interface BulletListInputProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  maxItemLength?: number;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// 들어온 HTML(글머리·문단·자유서식 등)을 줄 항목 배열로 환원. 서식/이미지는 버리고 텍스트만 남긴다.
// 항목/줄 경계(<li>·<br>·블록 종료)를 개행으로 바꾼 뒤 줄 단위로 나눈다.
function parseItems(html: string): string[] {
  if (!html) return [''];
  const text = html
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  const items = text.split('\n').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : [''];
}

function serializeItems(items: string[]): string {
  const nonEmpty = items.map((s) => s.trim()).filter(Boolean);
  if (!nonEmpty.length) return '';
  return `<ul>${nonEmpty.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
}

export default function BulletListInput({ value, onChange, placeholder, disabled, minHeight = 120, maxItemLength = 200 }: BulletListInputProps) {
  const [items, setItems] = useState<string[]>(() => parseItems(value));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const focusIdxRef = useRef<number | null>(null);

  // 추가/삭제 후 지정한 행으로 포커스 이동(커서는 끝으로).
  useEffect(() => {
    if (focusIdxRef.current == null) return;
    const el = inputsRef.current[focusIdxRef.current];
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
    focusIdxRef.current = null;
  }, [items]);

  const commit = (next: string[]) => {
    setItems(next);
    onChange(serializeItems(next));
  };

  const updateAt = (i: number, v: string) => {
    const next = items.slice();
    next[i] = v;
    commit(next);
  };

  const addAfter = (i: number) => {
    const next = items.slice();
    next.splice(i + 1, 0, '');
    focusIdxRef.current = i + 1;
    commit(next);
  };

  const removeAt = (i: number) => {
    if (items.length <= 1) { commit(['']); return; }
    const next = items.slice();
    next.splice(i, 1);
    focusIdxRef.current = Math.max(0, i - 1);
    commit(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    // 한글 IME 조합 중 Enter 는 글자 확정용이므로 새 줄로 처리하지 않는다.
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addAfter(i);
    } else if (e.key === 'Backspace' && items[i] === '' && items.length > 1) {
      e.preventDefault();
      removeAt(i);
    }
  };

  return (
    <div
      className={`rounded border border-gray-300 bg-white px-2.5 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${disabled ? 'opacity-70' : ''}`}
      style={{ minHeight }}
    >
      <div className="space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 select-none text-center font-bold text-primary/60" aria-hidden>*</span>
            <input
              ref={(el) => { inputsRef.current[i] = el; }}
              value={item}
              disabled={disabled}
              maxLength={maxItemLength}
              onChange={(e) => updateAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              placeholder={i === 0 && items.length === 1 ? placeholder : ''}
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => addAfter(items.length - 1)}
        className="ml-5 mt-1 text-[11px] font-semibold text-gray-400 hover:text-primary disabled:opacity-40"
      >
        + 줄 추가
      </button>
    </div>
  );
}
