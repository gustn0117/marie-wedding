'use client';

import { useRef, useEffect, useState } from 'react';
import { toast } from '@/shared/components/Toast';
import { isAbortError, mapWithConcurrency, uploadOptimizedImage } from '@/shared/utils/upload';
import { uploadOptimizedImageToEndpoint } from '@/shared/utils/uploadEndpoint';
import { MAX_IMAGE_INPUT_BYTES } from '@/shared/utils/image';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  disabled?: boolean;
  /** 이미지 업로드에 사용할 Supabase Storage 버킷 */
  imageBucket?: string;
  /** 비밀번호 관리자처럼 브라우저 Storage 세션이 없는 화면의 same-origin 업로드 API. */
  imageUploadEndpoint?: string;
  /** 부모 폼이 저장 직전에 진행 중인 본문 이미지 업로드를 기다릴 수 있게 한다. */
  onUploadPromise?: (promise: Promise<unknown>) => void;
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
const MAX_ACTIVE_SOURCE_BYTES = 60 * 1024 * 1024;
const IMAGE_BATCH_TIMEOUT_MS = 60_000;
const QUEUED_IMAGE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22450%22 viewBox=%220 0 800 450%22%3E%3Crect width=%22800%22 height=%22450%22 fill=%22%23f3f4f6%22/%3E%3Cpath d=%22M330 245l45-50 38 42 25-28 52 61H310z%22 fill=%22%23d1d5db%22/%3E%3Ccircle cx=%22435%22 cy=%22175%22 r=%2218%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E';

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

/** 드롭 좌표에서 editor 직계 블록 + 그 블록의 앞/뒤 여부를 구한다. */
function caretBlockFromPoint(x: number, y: number, editor: HTMLElement): { block: HTMLElement; before: boolean } | null {
  let node: Node | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = document as any;
  if (typeof doc.caretRangeFromPoint === 'function') {
    node = doc.caretRangeFromPoint(x, y)?.startContainer ?? null;
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    node = doc.caretPositionFromPoint(x, y)?.offsetNode ?? null;
  }
  let el: HTMLElement | null = node
    ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))
    : null;
  if (el) {
    while (el && el.parentElement && el.parentElement !== editor) el = el.parentElement;
  }
  if (!el || el.parentElement !== editor) {
    // fallback: Y 기준 가장 가까운 직계 블록
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    for (const b of Array.from(editor.children) as HTMLElement[]) {
      const r = b.getBoundingClientRect();
      const dist = Math.abs(y - (r.top + r.height / 2));
      if (dist < bestDist) { bestDist = dist; best = b; }
    }
    el = best;
  }
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { block: el, before: y < rect.top + rect.height / 2 };
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160, className = '', disabled = false, imageBucket = 'job-images', imageUploadEndpoint, onUploadPromise }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const draggedImgRef = useRef<HTMLImageElement | null>(null);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});
  const [pendingUploads, setPendingUploads] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mountedRef = useRef(true);
  const activeUploadsRef = useRef(new Map<string, {
    controller: AbortController;
    previewUrl: string | null;
    progress: number;
    sourceBytes: number;
  }>());
  // 이미지 툴바 상태 — 선택된 이미지 요소와 뷰포트 기준 위치
  const [imgToolbar, setImgToolbar] = useState<{ el: HTMLImageElement; top: number; left: number } | null>(null);

  useEffect(() => {
    if (activeUploadsRef.current.size > 0) return;
    const safeValue = sanitize(value || '');
    if (editorRef.current && editorRef.current.innerHTML !== safeValue) {
      // API를 직접 호출해 저장한 비정상 HTML도 편집 화면 DOM에 그대로 주입하지 않는다.
      editorRef.current.innerHTML = safeValue;
    }
  }, [value]);

  // execCommand 가 <font> 나 align 속성 대신 CSS 인라인 스타일을 쓰도록 지시
  // → 저장 후 sanitizer 가 유지하는 text-align 정책과 일치
  useEffect(() => {
    try { document.execCommand('styleWithCSS', false, 'true'); } catch {}
  }, []);

  useEffect(() => {
    const uploads = activeUploadsRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploads.forEach(({ controller, previewUrl }) => {
        controller.abort();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
      uploads.clear();
    };
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
    // Backspace/Ctrl+A/모바일 키보드로 업로드 자리표시자가 지워진 경우에도 실제
    // 압축·전송을 즉시 취소한다. 툴바 삭제 버튼만 취소하던 race를 닫는다.
    activeUploadsRef.current.forEach(({ controller }, id) => {
      if (!editorRef.current?.querySelector(`img[data-upload-id="${id}"]`)) {
        controller.abort();
      }
    });
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('img[data-upload-id]').forEach((img) => img.remove());
    const html = sanitize(clone.innerHTML);
    onChange(html);
  };

  // 편집 영역 클릭 시 이미지 감지 → 툴바 표시
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
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
    const uploadId = imgToolbar.el.dataset.uploadId;
    if (uploadId) activeUploadsRef.current.get(uploadId)?.controller.abort();
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

  // 이미지 드래그&드롭으로 재배치 (데스크톱). 모바일은 툴바 ↑/↓ 버튼 사용.
  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      draggedImgRef.current = null;
      return;
    }
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.classList.contains('rich-text-image')) {
      draggedImgRef.current = target as HTMLImageElement;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', 'rt-img'); } catch { /* noop */ }
      setImgToolbar(null);
    } else {
      draggedImgRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    if (draggedImgRef.current) {
      e.preventDefault(); // 드롭 허용
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      draggedImgRef.current = null;
      return;
    }
    const img = draggedImgRef.current;
    const editor = editorRef.current;
    draggedImgRef.current = null;
    if (!img || !editor) return;
    e.preventDefault(); // 기본 드롭(중복 삽입) 방지

    // 드래그된 이미지를 담은 editor 직계 블록
    let imgBlock: HTMLElement = img;
    while (imgBlock.parentElement && imgBlock.parentElement !== editor) imgBlock = imgBlock.parentElement;
    if (imgBlock.parentElement !== editor) return;

    const point = caretBlockFromPoint(e.clientX, e.clientY, editor);
    if (!point || point.block === imgBlock) { handleInput(); return; }

    if (point.before) editor.insertBefore(imgBlock, point.block);
    else editor.insertBefore(imgBlock, point.block.nextSibling);
    handleInput();
    const rect = img.getBoundingClientRect();
    setImgToolbar({ el: img, top: rect.top, left: rect.left + rect.width / 2 });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // 붙여넣기 이미지(클립보드 이미지)를 업로드
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          queueImages([file]);
          return;
        }
      }
    }
    // 그 외에는 plain text 붙여넣기
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const refreshAggregateProgress = () => {
    if (!mountedRef.current) return;
    const uploads = Array.from(activeUploadsRef.current.values());
    setPendingUploads(uploads.length);
    setUploadProgress(uploads.length
      ? Math.round(uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length)
      : 0);
  };

  const queueImages = (selectedFiles: File[]) => {
    if (disabled) return;
    const available = Math.max(0, 12 - activeUploadsRef.current.size);
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const validFiles = imageFiles.filter((file) => file.size > 0 && file.size <= MAX_IMAGE_INPUT_BYTES);
    const activeSourceBytes = Array.from(activeUploadsRef.current.values())
      .reduce((sum, upload) => sum + upload.sourceBytes, 0);
    let remainingBytes = Math.max(0, MAX_ACTIVE_SOURCE_BYTES - activeSourceBytes);
    const files: File[] = [];
    for (const file of validFiles) {
      if (files.length >= available) break;
      if (file.size > remainingBytes) continue;
      files.push(file);
      remainingBytes -= file.size;
    }
    if (validFiles.length < imageFiles.length) {
      toast('사진은 비어 있지 않은 30MB 이하 이미지만 올릴 수 있습니다.', 'error');
    }
    if (files.length === 0) {
      if (validFiles.length > 0) toast('동시에 올릴 수 있는 사진은 최대 12장입니다.', 'error');
      return;
    }
    if (files.length < validFiles.length) {
      toast('사진은 최대 12장, 처리 중 원본 합계 60MB까지 추가할 수 있습니다.', 'error');
    }

    const jobs = files.map((file) => {
      const id = crypto.randomUUID();
      const controller = new AbortController();
      // 원본 Blob은 미리보기로 디코드하지 않고 작은 SVG를 즉시 렌더한다.
      // 업로드가 끝난 뒤에만 작은 압축본/공개 URL로 교체한다.
      activeUploadsRef.current.set(id, {
        controller,
        previewUrl: null,
        progress: 0,
        sourceBytes: file.size,
      });

      editorRef.current?.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${QUEUED_IMAGE_PLACEHOLDER}" alt="업로드 중" data-upload-id="${id}" class="rich-text-image" style="display:block;margin:10px auto;max-width:100%;opacity:.65" /><p><br></p>`,
      );
      return { id, file, controller };
    });
    refreshAggregateProgress();

    const batch = (async () => {
      let batchTimedOut = false;
      const batchTimer = window.setTimeout(() => {
        batchTimedOut = true;
        jobs.forEach(({ controller }) => controller.abort(
          new DOMException('사진 일괄 업로드 시간이 초과되었습니다.', 'AbortError'),
        ));
      }, IMAGE_BATCH_TIMEOUT_MS);
      let results: PromiseSettledResult<void>[];
      try {
        results = await mapWithConcurrency(jobs, 3, async ({ id, file, controller }) => {
        try {
          if (controller.signal.aborted || !activeUploadsRef.current.has(id)) {
            throw controller.signal.reason
              ?? new DOMException('사진 업로드가 취소되었습니다.', 'AbortError');
          }
          const placeholder = editorRef.current?.querySelector<HTMLImageElement>(`img[data-upload-id="${id}"]`);
          if (!placeholder) {
            controller.abort();
            return;
          }
          const progressHandler = ({ percent }: { percent: number }) => {
            const current = activeUploadsRef.current.get(id);
            if (!current) return;
            current.progress = percent;
            refreshAggregateProgress();
          };
          const compressedPreviewHandler = (compressed: File) => {
            const current = activeUploadsRef.current.get(id);
            const image = editorRef.current?.querySelector<HTMLImageElement>(`img[data-upload-id="${id}"]`);
            if (!current || !image || controller.signal.aborted) return;
            if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
            const url = URL.createObjectURL(compressed);
            current.previewUrl = url;
            image.src = url;
          };
          const result = imageUploadEndpoint
            ? await uploadOptimizedImageToEndpoint(file, {
                endpoint: imageUploadEndpoint,
                maxDimension: 1200,
                maxSizeMB: 0.75,
                quality: 0.8,
                signal: controller.signal,
                onUploadProgress: progressHandler,
                onCompressedPreview: compressedPreviewHandler,
              })
            : await uploadOptimizedImage(file, {
                bucket: imageBucket,
                buildPath: (compressed) => {
                  const extension = compressed.type === 'image/jpeg' ? 'jpg' : 'webp';
                  return `content/${Date.now()}_${crypto.randomUUID()}.${extension}`;
                },
                maxDimension: 1200,
                maxSizeMB: 0.75,
                quality: 0.8,
                signal: controller.signal,
                onUploadProgress: progressHandler,
                onCompressedPreview: compressedPreviewHandler,
              });
          const image = editorRef.current?.querySelector<HTMLImageElement>(`img[data-upload-id="${id}"]`);
          if (!image || controller.signal.aborted) return;
          image.src = 'url' in result && typeof result.url === 'string'
            ? result.url
            : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${imageBucket}/${result.path}`;
          image.alt = '';
          image.style.opacity = '';
          delete image.dataset.uploadId;
        } catch (error) {
          editorRef.current?.querySelector<HTMLImageElement>(`img[data-upload-id="${id}"]`)?.remove();
          if (!isAbortError(error)) {
            toast(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.', 'error');
            throw error instanceof Error ? error : new Error('이미지 업로드에 실패했습니다.');
          }
        } finally {
          const active = activeUploadsRef.current.get(id);
          if (active?.previewUrl) URL.revokeObjectURL(active.previewUrl);
          activeUploadsRef.current.delete(id);
          refreshAggregateProgress();
          if (mountedRef.current) handleInput();
        }
        });
      } finally {
        window.clearTimeout(batchTimer);
      }
      if (batchTimedOut) {
        const timeoutError = new Error('사진 일괄 업로드가 1분을 초과해 취소했습니다. 다시 시도해주세요.');
        toast(timeoutError.message, 'error');
        throw timeoutError;
      }
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    })();
    onUploadPromise?.(batch);
    // 부모 tracker가 없는 재사용 화면에서도 rejected batch가 전역
    // unhandledrejection으로 번지지 않게 하되, 원본 Promise의 실패 상태는 유지한다.
    void batch.catch(() => undefined);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    queueImages(Array.from(e.target.files || []));
    if (imgInputRef.current) imgInputRef.current.value = '';
  };

  return (
    <div
      aria-disabled={disabled || undefined}
      className={`border border-gray-300 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${disabled ? 'opacity-70' : ''} ${className}`}
    >
      {/* Toolbar */}
      <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
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
          disabled={pendingUploads >= 12}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {pendingUploads > 0 ? `사진 ${pendingUploads}장 ${uploadProgress}%` : '사진 추가'}
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
      </fieldset>

      {/* Editor */}
      <div
        className="relative"
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          queueImages(files);
        }}
      >
        {!value && pendingUploads === 0 && placeholder && (
          <div className="absolute top-3 left-4 text-gray-400 pointer-events-none text-[15px]">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onFocus={updateActiveFormats}
          onClick={handleEditorClick}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="px-4 py-3 text-[15px] text-gray-900 focus:outline-none rich-text-content break-words rich-text-editor-body"
          style={{ minHeight }}
        />

        {/* 이미지 플로팅 툴바 — 이미지 클릭 시 위에 뜨는 크기/정렬/삭제 컨트롤 */}
        {imgToolbar && !disabled && (
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
        <span>사진 <span className="font-semibold text-gray-600">드래그로 이동</span> · 클릭 시 크기·정렬 조절</span>
        <span>·</span>
        <span>권장 가로 <span className="font-semibold text-gray-600">1200px 이하</span></span>
        <span>·</span>
        <span>JPG / PNG / WebP, <span className="font-semibold text-gray-600">30MB</span> 이하</span>
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
