import { compressImage, type CompressImageOptions } from '@/shared/utils/image';
import { withOptimizedImageUploadSlot } from '@/shared/utils/optimizedImageUploadSemaphore';
import type { UploadProgress } from '@/shared/utils/upload';
import { createAbortScope } from '@/shared/utils/abort';

interface UploadOptimizedImageToEndpointOptions extends CompressImageOptions {
  endpoint: string;
  fieldName?: string;
  uploadTimeoutMs?: number;
  totalTimeoutMs?: number;
  onUploadProgress?: (progress: UploadProgress) => void;
  /** 압축 완료 시 네트워크 업로드를 기다리지 않고 작은 미리보기를 표시한다. */
  onCompressedPreview?: (file: File) => void;
}

interface EndpointUploadResult {
  path: string;
  url: string;
}

/**
 * 비밀번호 쿠키 등 서버 전용 권한이 필요한 업로드용 공통 경로.
 * 브라우저에서는 동일하게 워커 압축·실제 진행률·abort를 제공하고, 작은 압축본만 API로 보낸다.
 */
export async function uploadOptimizedImageToEndpoint(
  file: File,
  options: UploadOptimizedImageToEndpointOptions,
): Promise<EndpointUploadResult & { file: File }> {
  const {
    endpoint,
    fieldName = 'image',
    uploadTimeoutMs = 30_000,
    totalTimeoutMs = 60_000,
    signal,
    onUploadProgress,
    onCompressedPreview,
    ...compressOptions
  } = options;

  const abortScope = createAbortScope([signal], totalTimeoutMs);
  const taskSignal = abortScope.signal;
  try {
    return await withOptimizedImageUploadSlot(taskSignal, async () => {
      onUploadProgress?.({ phase: 'compressing', percent: 1 });
      const compressed = await compressImage(file, {
        ...compressOptions,
        signal: taskSignal,
        onProgress: (value) => onUploadProgress?.({
          phase: 'compressing',
          percent: Math.round(value * 0.35),
        }),
      });
      try { onCompressedPreview?.(compressed); } catch {}
      const result = await uploadFileToEndpoint({
        endpoint,
        fieldName,
        file: compressed,
        timeoutMs: uploadTimeoutMs,
        signal: taskSignal,
        onProgress: (value) => onUploadProgress?.({
          phase: 'uploading',
          percent: Math.min(100, 35 + Math.round(value * 0.65)),
        }),
      });
      onUploadProgress?.({ phase: 'uploading', percent: 100 });
      return { ...result, file: compressed };
    });
  } catch (error) {
    if (abortScope.timedOut && !signal?.aborted) {
      throw new Error('사진 처리와 업로드가 1분을 초과해 취소했습니다. 다시 시도해주세요.');
    }
    throw error;
  } finally {
    abortScope.dispose();
  }
}

async function uploadFileToEndpoint({
  endpoint,
  fieldName,
  file,
  timeoutMs,
  signal,
  onProgress,
}: {
  endpoint: string;
  fieldName: string;
  file: File;
  timeoutMs: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}): Promise<EndpointUploadResult> {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError');
  }

  return new Promise<EndpointUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', handleAbort);
      callback();
    };
    const handleAbort = () => {
      xhr.abort();
      finish(() => reject(signal?.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError')));
    };

    xhr.open('POST', endpoint);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let body: Partial<EndpointUploadResult> & { error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.path && body.url) {
        finish(() => resolve({ path: body.path!, url: body.url! }));
        return;
      }
      finish(() => reject(new Error(body.error || '이미지 업로드에 실패했습니다.')));
    };
    xhr.onerror = () => finish(() => reject(new Error('네트워크 연결이 끊겼습니다. 다시 시도해주세요.')));
    xhr.ontimeout = () => finish(() => reject(new Error('이미지 업로드 시간이 초과되었습니다. 다시 시도해주세요.')));
    xhr.onabort = () => finish(() => reject(new DOMException('업로드가 취소되었습니다.', 'AbortError')));
    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }

    const form = new FormData();
    form.set(fieldName, file);
    xhr.send(form);
  });
}
