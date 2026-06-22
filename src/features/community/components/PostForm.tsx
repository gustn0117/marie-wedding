'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { POST_CATEGORIES, REGIONS, ROUTES } from '@/shared/constants';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { communityService } from '../services/community-service';
import type { PostFormData } from '../types';

interface PostFormProps {
  initialData?: PostFormData;
  postId?: string;
  profileId?: string;
  onSubmitSuccess?: (postId: string) => void;
}

export default function PostForm({ initialData, postId, profileId, onSubmitSuccess }: PostFormProps) {
  const router = useRouter();
  const isEdit = !!postId;

  const [formData, setFormData] = useState<PostFormData>({
    title: initialData?.title ?? '',
    content: initialData?.content ?? '',
    category: initialData?.category ?? '',
    region: initialData?.region ?? '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    meaningfulChars(contentClean) >= 5 &&
    formData.category.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      if (!formData.category) setError('카테고리를 선택해주세요.');
      else if (meaningfulChars(titleClean) < 2) setError('제목에 영문/숫자/한글을 2자 이상 입력해주세요.');
      else if (meaningfulChars(contentClean) < 5) setError('내용을 5자 이상 입력해주세요.');
      else setError('모든 필수 항목을 입력해주세요.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!isEdit && !profileId) {
      setError('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && postId) {
        await communityService.updatePost(postId, formData);
        if (onSubmitSuccess) onSubmitSuccess(postId);
        else router.push(ROUTES.COMMUNITY_DETAIL(postId));
        router.refresh();
      } else {
        const post = await communityService.createPost(formData, profileId!);
        if (onSubmitSuccess) onSubmitSuccess(post.id);
        else router.push(ROUTES.COMMUNITY_DETAIL(post.id));
        router.refresh();
      }
    } catch (err) {
      console.error('[PostForm] submit failed:', err);
      const base = isEdit ? '수정에 실패했습니다.' : '게시글 작성에 실패했습니다.';
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      setError(base + detail);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-state-urgent-bg border-l-4 border-state-urgent text-sm text-state-urgent">
          {error}
        </div>
      )}

      {/* Category */}
      <div className="space-y-2 rounded border border-gray-200 bg-white p-4">
        <label className="block text-sm font-semibold text-gray-800">카테고리 <span className="text-state-urgent">*</span></label>
        <div className="flex flex-wrap gap-2">
          {POST_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
              className={`rounded px-4 py-2 text-sm font-bold border transition-colors ${
                formData.category === cat.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Region (선택, 지역소식 등에서 유용) */}
      <div className="space-y-2 rounded border border-gray-200 bg-white p-4">
        <label className="block text-sm font-semibold text-gray-800">
          지역 <span className="text-xs font-normal text-gray-400">(선택, 지역소식·후기에 유용)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, region: '' }))}
            className={`rounded px-3 py-1.5 text-xs font-bold border ${
              !formData.region
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
            }`}
          >
            없음
          </button>
          {REGIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, region: r.value }))}
              className={`rounded px-3 py-1.5 text-xs font-bold border ${
                formData.region === r.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2 rounded border border-gray-200 bg-white p-4">
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
      </div>

      {/* Content */}
      <div className="space-y-2 rounded border border-gray-200 bg-white p-4">
        <label className="block text-sm font-semibold text-gray-800">내용 <span className="text-state-urgent">*</span></label>
        <RichTextEditor
          value={formData.content}
          onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
          placeholder="내용을 입력해주세요. 이미지, 굵기, 제목 등 다양한 서식을 사용할 수 있어요."
          minHeight={300}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-600 hover:border-primary hover:text-primary"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="rounded bg-primary px-8 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (isEdit ? '수정 중...' : '등록 중...') : (isEdit ? '수정하기' : '게시글 등록')}
        </button>
      </div>
    </form>
  );
}
