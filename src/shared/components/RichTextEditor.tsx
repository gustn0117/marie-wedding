'use client';

import { useRef, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  /** 이미지 업로드에 사용할 Supabase Storage 버킷 */
  imageBucket?: string;
}

// 허용 태그 (img 포함)
const ALLOWED_TAGS = ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'img'];
const ALLOWED_STYLES = ['font-weight', 'font-style', 'text-decoration', 'max-width', 'width', 'height'];
const IMG_ALLOWED_ATTRS = ['src', 'alt'];

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
          const textNode = document.createTextNode(el.textContent || '');
          el.parentNode?.replaceChild(textNode, el);
          return;
        }
        const attrs = Array.from(el.attributes);
        attrs.forEach(attr => {
          if (tag === 'img' && IMG_ALLOWED_ATTRS.includes(attr.name.toLowerCase())) {
            // img는 src/alt 유지
            if (attr.name.toLowerCase() === 'src' && attr.value.startsWith('javascript:')) {
              el.removeAttribute(attr.name);
            }
            return;
          }
          if (attr.name === 'style') {
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
        // img는 반응형 클래스 추가
        if (tag === 'img') {
          el.setAttribute('class', 'rich-text-image');
        }
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

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160, className = '', imageBucket = 'job-images' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);

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
    // 붙여넣기 이미지(클립보드 이미지)를 업로드
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          uploadAndInsertImage(file);
          return;
        }
      }
    }
    // 그 외에는 plain text 붙여넣기
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const uploadAndInsertImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('이미지는 10MB 이하여야 합니다.');
      return;
    }
    if (!file.type.startsWith('image/')) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `content_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(imageBucket).upload(path, file);
      if (uploadError) throw new Error(uploadError.message);
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${imageBucket}/${path}`;

      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${url}" alt="" class="rich-text-image" /><p><br></p>`);
      handleInput();
    } catch (err) {
      alert(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndInsertImage(file);
    if (imgInputRef.current) imgInputRef.current.value = '';
  };

  return (
    <div className={`border border-gray-300 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
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

        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Image Upload */}
        <ToolbarButton onClick={() => imgInputRef.current?.click()} title="이미지 추가">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </ToolbarButton>
        {uploading && <span className="text-xs text-gray-500 ml-2">업로드 중...</span>}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
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
          className="px-4 py-3 text-[15px] text-gray-900 focus:outline-none rich-text-content break-words"
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
