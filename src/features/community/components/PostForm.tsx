'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { POST_CATEGORIES, ROUTES } from '@/shared/constants';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { communityService } from '../services/community-service';
import type { PostFormData } from '../types';

export default function PostForm() {
  const router = useRouter();
  const { profile } = useAuth();

  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    content: '',
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    formData.title.trim().length > 0 &&
    formData.content.trim().length > 0 &&
    formData.category.length > 0;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !profile) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const post = await communityService.createPost(formData, profile.id);
      router.push(ROUTES.COMMUNITY_DETAIL(post.id));
    } catch (err) {
      console.error('Failed to create post:', err);
      setError('게시글 작성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-text-primary mb-1.5">
          카테고리 <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="input-field"
          required
        >
          <option value="" disabled>
            카테고리를 선택해주세요
          </option>
          {POST_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1.5">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleChange}
          placeholder="제목을 입력해주세요"
          className="input-field"
          maxLength={100}
          required
        />
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-text-primary mb-1.5">
          내용 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          placeholder="내용을 입력해주세요"
          className="input-field resize-y"
          rows={8}
          required
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-outline text-sm"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="btn-primary text-sm"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              등록 중...
            </span>
          ) : (
            '게시글 등록'
          )}
        </button>
      </div>
    </form>
  );
}
