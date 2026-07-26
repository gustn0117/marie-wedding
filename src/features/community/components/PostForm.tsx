'use client';

import { useRef, useState } from 'react';
import { useUnsavedChangesWarning } from '@/shared/hooks/useUnsavedChangesWarning';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { FieldWarning, fieldWrapClass } from '@/shared/components/FieldWarning';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';
import { communityService } from '../services/community-service';
import type { PostFormData } from '../types';
import { withTimeout } from '@/shared/utils/withTimeout';
import { friendlyError } from '@/shared/utils/errorMessages';

interface PostFormProps {
  initialData?: PostFormData;
  postId?: string;
  profileId?: string;
  onSubmitSuccess?: (postId: string) => void;
}

export default function PostForm({ initialData, postId, profileId, onSubmitSuccess }: PostFormProps) {
  const router = useRouter();
  const isEdit = !!postId;

  const [formData, setFormDataRaw] = useState<PostFormData>({
    title: initialData?.title ?? '',
    content: initialData?.content ?? '',
    // 게시판(카테고리) 폐지 — 폼에서 선택 없이 기본값으로 저장(DB category 컬럼 호환)
    category: initialData?.category ?? 'jobtip',
  });
  // 미저장 변경 추적 — 이탈 시 경고(긴 본문 소실 방지).
  const [dirty, setDirty] = useState(false);
  const { fieldError, setFieldError, showFieldIssue } = useFieldError('postfield');
  const setFormData = (v: Parameters<typeof setFormDataRaw>[0]) => { setDirty(true); setFieldError(null); setFormDataRaw(v); };
  useUnsavedChangesWarning(dirty);
  const contentRef = useRef(formData.content);
  // 같은 작성 폼의 재시도는 동일 ID를 사용해 응답 유실 시 중복 글을 만들지 않는다.
  const createIdRef = useRef<string | null>(null);
  const { trackUpload, waitForUploads, pendingCount } = usePendingUploads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // 의미있는 문자(영문/숫자/한글)가 최소 2자 이상 포함되어야 함
  // 한글/영문/숫자 문자 카운트 (특수문자·공백 제외)
  const meaningfulChars = (s: string) =>
    (s.match(/[A-Za-z0-9가-힯ㄱ-ㆎ]/g) || []).length;
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  const titleClean = formData.title.trim();
  const contentClean = stripHtml(formData.content);
  const isValid =
    titleClean.length >= 2 &&
    meaningfulChars(titleClean) >= 2 &&
    contentClean.length >= 5 &&
    meaningfulChars(contentClean) >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!isValid) {
      if (meaningfulChars(titleClean) < 2) showFieldIssue({ field: 'title', message: '제목에 영문/숫자/한글을 2자 이상 입력해주세요.' });
      else showFieldIssue({ field: 'content', message: '내용을 5자 이상 입력해주세요.' });
      return;
    }
    if (!isEdit && !profileId) {
      setError('로그인이 필요합니다.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      await waitForUploads();
      const latestFormData = { ...formData, content: contentRef.current };
      if (isEdit && postId) {
        await withTimeout(
          communityService.updatePost(postId, latestFormData),
          12000,
          '게시글 수정 지연',
        );
        setDirty(false); // 저장 성공 = 미저장 변경 없음(이탈 경고 해제)
        if (onSubmitSuccess) onSubmitSuccess(postId);
        else {
          router.push(ROUTES.COMMUNITY_DETAIL(postId));
          router.refresh();
        }
      } else {
        const createId = createIdRef.current ?? crypto.randomUUID();
        createIdRef.current = createId;
        const post = await withTimeout(
          communityService.createPost(latestFormData, profileId!, createId),
          12000,
          '게시글 등록 지연',
        );
        // 저장 성공 = 미저장 변경 없음. 안 풀면 이탈 경고가 남아 등록 직후에도 뜬다.
        setDirty(false);
        if (onSubmitSuccess) onSubmitSuccess(post.id);
        else {
          router.push(ROUTES.COMMUNITY_DETAIL(post.id));
          router.refresh();
        }
      }
    } catch (err) {
      console.error('[PostForm] submit failed:', err);
      const base = isEdit ? '수정에 실패했습니다.' : '게시글 작성에 실패했습니다.';
      setError(friendlyError(err, base));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={isSubmitting} className="contents">
      {error && (
        <div className="p-3 bg-state-urgent-bg border-l-4 border-state-urgent text-sm text-state-urgent">
          {error}
        </div>
      )}

      {/* Title */}
      <div id="postfield-title" className={`space-y-2 rounded border border-gray-200 bg-white p-4 ${fieldWrapClass(fieldError?.field === 'title')}`}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-800">제목 <span className="text-state-urgent">*</span></label>
          <span className="text-xs text-gray-400">{formData.title.length}/100</span>
        </div>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="제목을 입력해주세요"
          className="w-full rounded border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-100"
          maxLength={100}
          required
        />
        {fieldError?.field === 'title' && <FieldWarning message={fieldError.message} />}
      </div>

      {/* Content */}
      <div id="postfield-content" className={`space-y-2 rounded border border-gray-200 bg-white p-4 ${fieldWrapClass(fieldError?.field === 'content')}`}>
        <label className="block text-sm font-semibold text-gray-800">내용 <span className="text-state-urgent">*</span></label>
        <RichTextEditor
          value={formData.content}
          onChange={(html) => {
            contentRef.current = html;
            setFormData((prev) => ({ ...prev, content: html }));
          }}
          placeholder="내용을 입력해주세요. 이미지, 굵기, 제목 등 다양한 서식을 사용할 수 있어요."
          minHeight={300}
          onUploadPromise={trackUpload}
          disabled={isSubmitting}
        />
        {fieldError?.field === 'content' && <FieldWarning message={fieldError.message} />}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => { if (!dirty || confirm('작성 중인 내용이 저장되지 않습니다. 나가시겠어요?')) router.back(); }}
          className="rounded border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-primary px-8 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? (pendingCount > 0
              ? `본문 사진 ${pendingCount}건 마무리 중...`
              : isEdit ? '수정 중...' : '등록 중...')
            : (isEdit ? '수정하기' : '게시글 등록')}
        </button>
      </div>
      </fieldset>
    </form>
  );
}
