import { createClient } from '@/lib/supabase/client';
import { compressImage, type CompressImageOptions } from '@/shared/utils/image';
import { withOptimizedImageUploadSlot } from '@/shared/utils/optimizedImageUploadSemaphore';
import { createAbortScope } from '@/shared/utils/abort';

export type UploadPhase = 'compressing' | 'uploading';

export interface UploadProgress {
  phase: UploadPhase;
  percent: number;
}

interface UploadOptimizedImageOptions extends CompressImageOptions {
  bucket: string;
  buildPath: (compressed: File) => string;
  cacheControl?: string;
  upsert?: boolean;
  uploadTimeoutMs?: number;
  totalTimeoutMs?: number;
  onUploadProgress?: (progress: UploadProgress) => void;
  /** 압축이 끝나는 즉시 안전한 작은 미리보기를 표시할 때 사용한다. */
  onCompressedPreview?: (file: File) => void;
}

export async function uploadOptimizedImage(
  file: File,
  options: UploadOptimizedImageOptions,
): Promise<{ path: string; file: File }> {
  const {
    bucket,
    buildPath,
    cacheControl = '31536000',
    upsert = false,
    uploadTimeoutMs = 45000,
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
      const path = buildPath(compressed);
      try { onCompressedPreview?.(compressed); } catch {}
      await uploadWithProgress({
        bucket,
        path,
        file: compressed,
        cacheControl,
        upsert,
        timeoutMs: uploadTimeoutMs,
        signal: taskSignal,
        onProgress: (value) => onUploadProgress?.({
          phase: 'uploading',
          percent: Math.min(100, 35 + Math.round(value * 0.65)),
        }),
      });
      onUploadProgress?.({ phase: 'uploading', percent: 100 });
      return { path, file: compressed };
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

interface UploadWithProgressOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  cacheControl?: string;
  upsert?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

/** Supabase Storage 직접 업로드. XHR을 사용해 실제 progress와 abort를 제공한다. */
export async function uploadWithProgress(options: UploadWithProgressOptions): Promise<void> {
  const {
    bucket,
    path,
    file,
    cacheControl = '31536000',
    upsert = false,
    timeoutMs = 45000,
    signal,
    onProgress,
  } = options;
  if (signal?.aborted) throw signal.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError');

  // 인증 조회는 정상 browser singleton을 사용한다. task signal을 client 전역
  // fetch에 캡처하면 파일 하나의 취소가 이후 모든 Supabase 요청을 오염시킨다.
  // 아래 8초 race가 UI 대기만 끊고, 실제 파일 전송은 XHR signal로 취소한다.
  const supabase = createClient();
  let abortSessionWait: (() => void) | null = null;
  let sessionTimer: ReturnType<typeof setTimeout> | null = null;
  const sessionWaitFailed = new Promise<never>((_, reject) => {
    abortSessionWait = () => reject(signal?.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError'));
    signal?.addEventListener('abort', abortSessionWait, { once: true });
    sessionTimer = setTimeout(
      () => reject(new Error('로그인 정보 확인이 지연되고 있습니다. 다시 시도해주세요.')),
      Math.min(8_000, Math.max(1, timeoutMs)),
    );
  });
  const sessionResult = await Promise.race([
    supabase.auth.getSession(),
    sessionWaitFailed,
  ]).finally(() => {
    if (sessionTimer) clearTimeout(sessionTimer);
    if (abortSessionWait) signal?.removeEventListener('abort', abortSessionWait);
  });
  if (sessionResult.error) {
    throw new Error('로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.');
  }
  const { session } = sessionResult.data;
  // getSession을 기다리는 동안 교체/삭제됐을 수 있다. 이미 abort된 signal에
  // listener를 뒤늦게 붙이면 이벤트가 오지 않아 취소된 파일이 그대로 전송된다.
  if (signal?.aborted) throw signal.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const accessToken = session?.access_token ?? anonKey;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const safePath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${safePath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', handleAbort);
      fn();
    };
    const handleAbort = () => {
      xhr.abort();
      finish(() => reject(signal?.reason ?? new DOMException('업로드가 취소되었습니다.', 'AbortError')));
    };

    xhr.open('POST', url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('x-upsert', String(upsert));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(resolve);
        return;
      }
      let message = '이미지 업로드에 실패했습니다.';
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message || body.error || message;
      } catch {}
      finish(() => reject(new Error(message)));
    };
    xhr.onerror = () => finish(() => reject(new Error('네트워크 연결이 끊겼습니다. 다시 시도해주세요.')));
    xhr.ontimeout = () => finish(() => reject(new Error('이미지 업로드 시간이 초과되었습니다. 다시 시도해주세요.')));
    xhr.onabort = () => finish(() => reject(new DOMException('업로드가 취소되었습니다.', 'AbortError')));
    signal?.addEventListener('abort', handleAbort, { once: true });

    // 초기 검사와 listener 등록 사이의 abort race를 닫는다.
    if (signal?.aborted) {
      handleAbort();
      return;
    }

    const body = new FormData();
    body.append('cacheControl', cacheControl);
    body.append('', file);
    xhr.send(body);
  });
}

/** 여러 파일을 무제한 동시 전송하지 않도록 동시성 수를 제한한다. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  return results;
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

export function formatUploadStatus(progress: UploadProgress | null): string {
  if (!progress) return '';
  return `${progress.phase === 'compressing' ? '사진 최적화' : '사진 업로드'} ${progress.percent}%`;
}
