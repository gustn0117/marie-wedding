'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';
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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    formData.title.trim().length > 0 &&
    formData.content.trim().length > 0 &&
    formData.category.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('모든 필수 항목을 입력해주세요.');
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
      } else {
        const post = await communityService.createPost(formData, profileId!);
        if (onSubmitSuccess) onSubmitSuccess(post.id);
        else router.push(ROUTES.COMMUNITY_DETAIL(post.id));
      }
    } catch {
      setError(isEdit ? '수정에 실패했습니다.' : '게시글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Category */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">카테고리 <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {POST_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
              className={`px-4 py-2 text-sm font-medium border transition-colors ${
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

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-800">제목 <span className="text-red-500">*</span></label>
          <span className="text-xs text-gray-400">{formData.title.length}/100</span>
        </div>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="제목을 입력해주세요"
          className="w-full px-4 py-3 border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          maxLength={100}
          required
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">내용 <span className="text-red-500">*</span></label>
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
          className="px-5 py-2.5 border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="px-8 py-2.5 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (isEdit ? '수정 중...' : '등록 중...') : (isEdit ? '수정하기' : '게시글 등록')}
        </button>
      </div>
    </form>
  );
}
