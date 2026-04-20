'use client';

import { useRef, useEffect, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

// 허용 태그로만 이루어진 HTML만 보존 (XSS 방지)
const ALLOWED_TAGS = ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li'];
const ALLOWED_STYLES = ['font-weight', 'font-style', 'text-decoration'];

function sanitize(html: string): string {
  if (typeof document === 'undefined') return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node: Node) => {
    const toRemove: Node[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TAGS.includes(tag)) {
          // 허용되지 않은 태그는 내부 텍스트만 보존
          const textNode = document.createTextNode(el.textContent || '');
          el.parentNode?.replaceChild(textNode, el);
          return;
        }
        // 모든 속성 제거 (style도 제거하되, 안전한 inline style만 남기려면 추가 처리 필요)
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
          if (attr.name === 'style') {
            // 안전한 스타일만 남기기
            const styles = attr.value.split(';').filter(s => {
              const prop = s.split(':')[0]?.trim().toLowerCase();
              return ALLOWED_STYLES.includes(prop);
            }).join(';');
            if (styles) el.setAttribute('style', styles);
            else el.removeAttribute('style');
          } else {
            el.removeAttribute(attr.name);
          }
        });
        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(n => n.parentNode?.removeChild(n));
  };

  walk(template.content);
  return template.innerHTML;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160, className = '' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  // 초기 value 세팅 (외부에서 value 바뀔 때만)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const updateActiveFormats = () => {
    if (typeof document === 'undefined') return;
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      h2: document.queryCommandValue('formatBlock') === 'h2',
      h3: document.queryCommandValue('formatBlock') === 'h3',
    });
  };

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
    updateActiveFormats();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = sanitize(editorRef.current.innerHTML);
    onChange(html);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className={`border border-gray-300 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolbarButton active={activeFormats.bold} onClick={() => exec('bold')} title="굵게 (Cmd+B)">
          <span className="font-bold text-sm">B</span>
        </ToolbarButton>
        <ToolbarButton active={activeFormats.italic} onClick={() => exec('italic')} title="기울임 (Cmd+I)">
          <span className="italic text-sm">I</span>
        </ToolbarButton>
        <ToolbarButton active={activeFormats.underline} onClick={() => exec('underline')} title="밑줄 (Cmd+U)">
          <span className="underline text-sm">U</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton active={activeFormats.h2} onClick={() => exec('formatBlock', activeFormats.h2 ? '<p>' : '<h2>')} title="큰 제목">
          <span className="font-bold text-base">대</span>
        </ToolbarButton>
        <ToolbarButton active={activeFormats.h3} onClick={() => exec('formatBlock', activeFormats.h3 ? '<p>' : '<h3>')} title="중간 제목">
          <span className="font-bold text-sm">중</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('formatBlock', '<p>')} title="본문 크기">
          <span className="text-xs">소</span>
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="글머리 기호">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="번호 매기기">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 111.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 010 2.25H3.74m0-.002h.375a1.125 1.125 0 010 2.25H2.99" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="relative">
        {!value && placeholder && (
          <div className="absolute top-3 left-4 text-gray-400 pointer-events-none text-[15px]">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onFocus={updateActiveFormats}
          className="px-4 py-3 text-[15px] text-gray-900 focus:outline-none rich-text-content"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center transition-colors ${
        active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}
