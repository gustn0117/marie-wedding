import { apiFetch, apiFetchJson } from '@/shared/utils/apiFetch';
import { uploadOptimizedImageToEndpoint } from '@/shared/utils/uploadEndpoint';
import type { UploadProgress } from '@/shared/utils/upload';
import { friendlyError } from '@/shared/utils/errorMessages';

export interface Banner {
  id: string;
  title: string;
  image_path_pc: string | null;
  image_path_mobile: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BannerInput {
  title: string;
  image_path_pc?: string | null;
  image_path_mobile?: string | null;
  link_url?: string | null;
  display_order?: number;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

export class BannerCreatePayloadMismatchError extends Error {
  readonly existingImagePaths: { pc: string | null; mobile: string | null };

  constructor(message: string, existingImagePaths: { pc: string | null; mobile: string | null }) {
    super(message);
    this.name = 'BannerCreatePayloadMismatchError';
    this.existingImagePaths = existingImagePaths;
  }
}

const MAX_BANNER_SOURCE_BYTES = 25 * 1024 * 1024;
const BANNER_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const bannerService = {
  async listAll(): Promise<Banner[]> {
    const result = await apiFetchJson<{ data: Banner[] }>(
      '/api/admin/banners',
      { cache: 'no-store' },
      { timeoutMs: 12000, fallbackError: '배너를 불러오지 못했습니다.' },
    );
    return result.data;
  },

  async create(input: BannerInput, createId: string): Promise<Banner> {
    const res = await apiFetch(
      '/api/admin/banners',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: createId, input }),
      },
      12000,
    );
    const result = await res.json().catch(() => ({})) as {
      data?: Banner;
      error?: string;
      code?: string;
      existingImagePaths?: { pc?: unknown; mobile?: unknown };
    };
    if (!res.ok) {
      if (res.status === 409 && result.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
        const paths = result.existingImagePaths;
        const conflictMessage = typeof result.error === 'string'
          ? result.error
          : '기존에 생성된 배너를 확인한 뒤 해당 항목을 수정해주세요.';
        throw new BannerCreatePayloadMismatchError(conflictMessage, {
          pc: typeof paths?.pc === 'string' ? paths.pc : null,
          mobile: typeof paths?.mobile === 'string' ? paths.mobile : null,
        });
      }
      throw new Error(friendlyError(result.error, '배너를 등록하지 못했습니다.'));
    }
    if (!result.data) throw new Error('배너 저장 결과를 확인하지 못했습니다.');
    return result.data;
  },

  async update(id: string, input: Partial<BannerInput>): Promise<Banner> {
    const result = await apiFetchJson<{ data: Banner }>(
      '/api/admin/banners',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, input }),
      },
      { timeoutMs: 12000, fallbackError: '배너를 수정하지 못했습니다.' },
    );
    return result.data;
  },

  async softDelete(id: string): Promise<void> {
    await apiFetchJson<{ ok: true }>(
      '/api/admin/banners',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      },
      { timeoutMs: 12000, fallbackError: '배너를 삭제하지 못했습니다.' },
    );
  },

  async uploadImage(
    file: File,
    kind: 'pc' | 'mobile',
    signal?: AbortSignal,
    onProgress?: (progress: UploadProgress) => void,
    onCompressedPreview?: (file: File) => void,
  ): Promise<{ path: string; file: File }> {
    if (!BANNER_IMAGE_EXTENSIONS[file.type]) {
      throw new Error('JPG, PNG, WebP 이미지만 업로드할 수 있습니다.');
    }
    if (file.size <= 0 || file.size > MAX_BANNER_SOURCE_BYTES) {
      throw new Error('원본 이미지는 25MB 이하여야 합니다.');
    }

    const result = await uploadOptimizedImageToEndpoint(file, {
      endpoint: `/api/admin/banners/upload?kind=${kind}`,
      maxDimension: kind === 'pc' ? 2400 : 1600,
      maxSizeMB: kind === 'pc' ? 1.5 : 1,
      quality: 0.88,
      mimeType: 'image/jpeg',
      uploadTimeoutMs: 35_000,
      signal,
      onUploadProgress: onProgress,
      onCompressedPreview,
    });
    return { path: result.path, file: result.file };
  },

  async removeImage(path: string): Promise<void> {
    if (!path || !/^(pc|mobile)\/[a-zA-Z0-9._-]+$/.test(path)) return;
    await apiFetchJson<{ ok: true }>(
      '/api/admin/banners/upload',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      },
      { timeoutMs: 12000, fallbackError: '배너 이미지를 정리하지 못했습니다.' },
    );
  },

  publicUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/banners/${path}`;
  },
};
