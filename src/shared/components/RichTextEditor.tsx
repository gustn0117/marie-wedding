'use client';

import { useRef, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/shared/utils/image';
import { withTimeout } from '@/shared/utils/withTimeout';
import { toast } from '@/shared/components/Toast';

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
const ALLOWED_STYLES = [
  'font-weight', 'font-style', 'text-decoration', 'text-align',
  'max-width', 'width', 'height',
  // 이미지 정렬·크기 컨트롤 지원
  'display', 'margin', 'margin-left', 'margin-right', 'float',
];
const IMG_ALLOWED_ATTRS = ['src', 'alt', 'style'];

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
        const filterStyle = (raw: string) =>
          raw.split(';').filter(s => {
            const prop = s.split(':')[0]?.trim().toLowerCase();
            return ALLOWED_STYLES.includes(prop);
          }).join(';');
        attrs.forEach(attr => {
          const name = attr.name.toLowerCase();
          if (tag === 'img' && IMG_ALLOWED_ATTRS.includes(name)) {
            if (name === 'src' && attr.value.startsWith('javascript:')) {
              el.removeAttribute(attr.name);
              return;
            }
            if (name === 'style') {
              const styles = filterStyle(attr.value);
              if (styles) el.setAttribute('style', styles);
              else el.removeAttribute('style');
            }
            return;
          }
          if (name === 'style') {
            const styles = filterStyle(attr.value);
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
  // 이미지 툴바 상태 — 선택된 이미지 요소와 뷰포트 기준 위치
  const [imgToolbar, setImgToolbar] = useState<{ el: HTMLImageElement; top: number; left: number } | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  // execCommand 가 <font> 나 align 속성 대신 CSS 인라인 스타일을 쓰도록 지시
  // → 저장 후 sanitizer 가 유지하는 text-align 정책과 일치
  useEffect(() => {
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
  }, []);

  // 스크롤/리사이즈 시 툴바 위치 재계산
  useEffect(() => {
    if (!imgToolbar) return;
    const reposition = () => {
      if (!imgToolbar.el.isConnected) { setImgToolbar(null); return; }
      const rect = imgToolbar.el.getBoundingClientRect();
      setImgToolbar((prev) => prev ? { ...prev, top: rect.top, left: rect.left + rect.width / 2 } : null);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [imgToolbar]);

  const updateActiveFormats = () => {
    if (typeof document === 'undefined') return;
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      h2: document.queryCommandValue('formatBlock') === 'h2',
      h3: document.queryCommandValue('formatBlock') === 'h3',
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
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

  // 편집 영역 클릭 시 이미지 감지 → 툴바 표시
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const rect = img.getBoundingClientRect();
      setImgToolbar({ el: img, top: rect.top, left: rect.left + rect.width / 2 });
    } else {
      setImgToolbar(null);
    }
  };

  // 이미지 크기 프리셋 적용 (부모 컨테이너 대비 %)
  const setImgWidth = (percent: 25 | 50 | 75 | 100) => {
    if (!imgToolbar) return;
    imgToolbar.el.style.width = `${percent}%`;
    imgToolbar.el.style.height = 'auto';
    imgToolbar.el.style.maxWidth = '100%';
    handleInput();
    // 위치 재계산
    const rect = imgToolbar.el.getBoundingClientRect();
    setImgToolbar({ el: imgToolbar.el, top: rect.top, left: rect.left + rect.width / 2 });
  };

  // 이미지 정렬
  const setImgAlign = (align: 'left' | 'center' | 'right') => {
    if (!imgToolbar) return;
    const img = imgToolbar.el;
    // 이전 정렬 스타일 정리
    img.style.display = '';
    img.style.marginLeft = '';
    img.style.marginRight = '';
    img.style.float = '';
    if (align === 'center') {
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    } else if (align === 'left') {
      img.style.display = 'block';
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    } else {
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }
    handleInput();
    const rect = img.getBoundingClientRect();
    setImgToolbar({ el: img, top: rect.top, left: rect.left + rect.width / 2 });
  };

  const deleteImg = () => {
    if (!imgToolbar) return;
    imgToolbar.el.remove();
    handleInput();
    setImgToolbar(null);
  };

  // 이미지(를 담은 블록)를 위/아래로 이동 — 드래그 대신 확실한 재배치(모바일 포함)
  const moveImg = (dir: -1 | 1) => {
    if (!imgToolbar) return;
    const editor = editorRef.current;
    if (!editor) return;
    const img = imgToolbar.el;
    // 이미지를 담은 editor 직계 블록 찾기
    let block: HTMLElement = img;
    while (block.parentElement && block.parentElement !== editor) {
      block = block.parentElement;
    }
    if (block.parentElement !== editor) return;
    const sibling = dir === -1 ? block.previousElementSibling : block.nextElementSibling;
    if (!sibling) return;
    if (dir === -1) editor.insertBefore(block, sibling);
    else editor.insertBefore(sibling, block);
    handleInput();
    const rect = img.getBoundingClientRect();
    setImgToolbar({ el: img, top: rect.top, left: rect.left + rect.width / 2 });
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
    // 크기 제한 없음 — 큰 이미지는 압축(웹 워커)해서 업로드.
    if (!file.type.startsWith('image/')) return;

    setUploading(true);
    try {
      const supabase = createClient();
      // 본문 삽입용 이미지는 1000px 로 충분 — 압축·업로드 시간 최소화(모바일 대용량 사진 대응)
      const compressed = await compressImage(file, { maxDimension: 1000, quality: 0.8 });
      const ext = compressed.name.split('.').pop() || 'jpg';
      const path = `content_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await withTimeout(supabase.storage.from(imageBucket).upload(path, compressed), 30000, '이미지 업로드가 너무 오래 걸려요. 다시 시도해주세요.');
      if (uploadError) throw new Error(uploadError.message);
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${imageBucket}/${path}`;

      editorRef.current?.focus();
      // 기본을 '자기 줄(블록) + 가운데'로 삽입 → 줄바꿈·정렬·이동이 자연스럽게 동작.
      document.execCommand('insertHTML', false, `<img src="${url}" alt="" class="rich-text-image" style="display:block;margin:10px auto;max-width:100%" /><p><br></p>`);
      handleInput();
    } catch (err) {
      toast(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await uploadAndInsertImage(file);
    }
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

        <ToolbarButton active={activeFormats.alignLeft} onClick={() => exec('justifyLeft')} title="왼쪽 정렬">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={activeFormats.alignCenter} onClick={() => exec('justifyCenter')} title="가운데 정렬">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={activeFormats.alignRight} onClick={() => exec('justifyRight')} title="오른쪽 정렬">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" />
          </svg>
        </ToolbarButton>

        <div className="flex-1" />

        {/* Prominent Image Upload Button */}
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {uploading ? '업로드 중...' : '사진 추가'}
        </button>
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
      </div>

      {/* Editor */}
      <div
        className="relative"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={async (e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          for (const file of files) await uploadAndInsertImage(file);
        }}
      >
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
          onClick={handleEditorClick}
          className="px-4 py-3 text-[15px] text-gray-900 focus:outline-none rich-text-content break-words rich-text-editor-body"
          style={{ minHeight }}
        />

        {/* 이미지 플로팅 툴바 — 이미지 클릭 시 위에 뜨는 크기/정렬/삭제 컨트롤 */}
        {imgToolbar && (
          <div
            className="fixed z-50 -translate-x-1/2 -translate-y-full mt-[-8px] flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1 py-1 shadow-lg pointer-events-auto"
            style={{ top: imgToolbar.top, left: imgToolbar.left }}
            onMouseDown={(e) => e.preventDefault()} /* 편집 포커스 유지 */
          >
            <div className="flex items-center gap-0.5 px-1">
              <span className="text-[10px] text-gray-500 mr-1">크기</span>
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setImgWidth(p as 25 | 50 | 75 | 100)}
                  className="rounded px-1.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                  title={`${p}%`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <div className="flex items-center gap-0.5 px-1">
              <span className="text-[10px] text-gray-500 mr-1">정렬</span>
              <button type="button" onClick={() => setImgAlign('left')} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" title="왼쪽">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" /></svg>
              </button>
              <button type="button" onClick={() => setImgAlign('center')} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" title="가운데">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" /></svg>
              </button>
              <button type="button" onClick={() => setImgAlign('right')} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" title="오른쪽">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" /></svg>
              </button>
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <div className="flex items-center gap-0.5 px-1">
              <span className="text-[10px] text-gray-500 mr-1">이동</span>
              <button type="button" onClick={() => moveImg(-1)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" title="위로 이동">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
              </button>
              <button type="button" onClick={() => moveImg(1)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100" title="아래로 이동">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            </div>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button type="button" onClick={deleteImg} className="rounded p-1.5 text-state-urgent hover:bg-state-urgent-bg" title="삭제">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M5 6h14l-1.09 13.09A2 2 0 0116 21H8a2 2 0 01-1.91-1.91L5 6zm5 0V4a1 1 0 011-1h2a1 1 0 011 1v2" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="border-t border-gray-100 px-3 py-2 bg-gray-50 text-[11px] text-gray-400 flex items-center gap-1.5 flex-wrap">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span>사진 클릭 → <span className="font-semibold text-gray-600">크기·정렬·이동</span> 조절 · 붙여넣기 가능</span>
        <span>·</span>
        <span>권장 가로 <span className="font-semibold text-gray-600">1200px 이하</span></span>
        <span>·</span>
        <span>JPG / PNG, <span className="font-semibold text-gray-600">10MB</span> 이하</span>
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
