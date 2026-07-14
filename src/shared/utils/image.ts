/** 이미지 처리의 공통 제한. 압축 실패 시 대용량 원본을 그대로 올리지 않는다. */
export const MAX_IMAGE_INPUT_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 32_000_000;
const MAX_IMAGE_SIDE = 12_000;
const MAX_MAIN_THREAD_IMAGE_PIXELS = 12_000_000;
const IMAGE_HEADER_READ_BYTES = 4 * 1024 * 1024;

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
  maxSizeMB?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}
interface WorkerSuccess {
  type: 'done';
  blob: Blob;
}

interface WorkerProgress {
  type: 'progress';
  progress: number;
}

interface WorkerFailure {
  type: 'error';
  message: string;
  recoverable?: boolean;
}

type WorkerMessage = WorkerSuccess | WorkerProgress | WorkerFailure;

interface ImageDimensions {
  width: number;
  height: number;
}

function ascii(view: DataView, offset: number, length: number): string {
  if (offset < 0 || offset + length > view.byteLength) return '';
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function parseImageDimensions(view: DataView): ImageDimensions | null {
  // PNG
  if (view.byteLength >= 24
      && view.getUint32(0) === 0x89504e47
      && view.getUint32(4) === 0x0d0a1a0a) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // WebP: VP8X / VP8 / VP8L
  if (view.byteLength >= 30 && ascii(view, 0, 4) === 'RIFF' && ascii(view, 8, 4) === 'WEBP') {
    const chunk = ascii(view, 12, 4);
    if (chunk === 'VP8X') {
      const width = 1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16);
      const height = 1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16);
      return { width, height };
    }
    if (chunk === 'VP8 ' && view.getUint8(23) === 0x9d && view.getUint8(24) === 0x01 && view.getUint8(25) === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === 'VP8L' && view.getUint8(20) === 0x2f && view.byteLength >= 25) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }

  // JPEG SOF marker. 큰 EXIF가 있어도 4MB까지만 읽고, 그 안에서 크기를 확인할
  // 수 없는 비정상 파일은 디코드하지 않아 메모리 폭주를 fail-closed 한다.
  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < view.byteLength) {
      while (offset < view.byteLength && view.getUint8(offset) !== 0xff) offset += 1;
      while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset += 1;
      if (offset >= view.byteLength) break;
      const marker = view.getUint8(offset);
      offset += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > view.byteLength) break;
      const segmentLength = view.getUint16(offset);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
      if (sofMarkers.has(marker) && segmentLength >= 7) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += segmentLength;
    }
  }

  return null;
}

async function readImageDimensions(file: File): Promise<ImageDimensions> {
  const header = await file.slice(0, Math.min(file.size, IMAGE_HEADER_READ_BYTES)).arrayBuffer();
  const dimensions = parseImageDimensions(new DataView(header));
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error('사진 크기를 확인할 수 없습니다. JPG, PNG 또는 WebP 파일을 사용해주세요.');
  }
  if (dimensions.width > MAX_IMAGE_SIDE
      || dimensions.height > MAX_IMAGE_SIDE
      || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error('사진 해상도가 너무 큽니다. 3,200만 화소 이하로 줄여 다시 시도해주세요.');
  }
  return dimensions;
}

function abortError(message = '이미지 처리가 취소되었습니다.') {
  return new DOMException(message, 'AbortError');
}

/**
 * 고해상도 이미지를 전용 Worker + OffscreenCanvas에서 리사이즈한다.
 *
 * - 메인 스레드를 막지 않는다.
 * - 목표 픽셀 크기와 목표 바이트 크기를 모두 지킨다.
 * - timeout/교체/삭제 시 Worker를 실제 terminate한다.
 * - 실패 시 원본 업로드로 우회하지 않고 명확히 실패시킨다.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const {
    maxDimension = 1600,
    quality = 0.82,
    mimeType = 'image/webp',
    maxSizeMB = 0.9,
    timeoutMs = 20000,
    signal,
    onProgress,
  } = options;

  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다.');
  if (file.size <= 0) throw new Error('비어 있는 이미지 파일입니다.');
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    throw new Error('이미지는 30MB 이하만 업로드할 수 있습니다.');
  }
  if (signal?.aborted) throw signal.reason ?? abortError();

  const dimensions = await readImageDimensions(file);
  if (signal?.aborted) throw signal.reason ?? abortError();

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    if (dimensions.width * dimensions.height > MAX_MAIN_THREAD_IMAGE_PIXELS) {
      throw new Error('이 브라우저에서는 고해상도 사진을 안전하게 처리할 수 없습니다. 사진 크기를 줄여 다시 시도해주세요.');
    }
    return compressOnMainThreadWithTimeout(file, {
      maxDimension,
      quality,
      mimeType,
      maxSizeMB,
      timeoutMs,
      signal,
      onProgress,
    });
  }

  return new Promise<File>((resolve, reject) => {
    const startedAt = Date.now();
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url));
    } catch {
      if (dimensions.width * dimensions.height > MAX_MAIN_THREAD_IMAGE_PIXELS) {
        reject(new Error('이 브라우저에서는 고해상도 사진을 안전하게 처리할 수 없습니다. 사진 크기를 줄여 다시 시도해주세요.'));
        return;
      }
      void compressOnMainThreadWithTimeout(file, {
        maxDimension,
        quality,
        mimeType,
        maxSizeMB,
        timeoutMs,
        signal,
        onProgress,
      }).then(resolve, reject);
      return;
    }
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      fn();
    };

    const handleAbort = () => finish(() => reject(signal?.reason ?? abortError()));
    const timer = setTimeout(
      () => finish(() => reject(new Error('이미지 처리 시간이 초과되었습니다. 다른 사진으로 다시 시도해주세요.'))),
      timeoutMs,
    );

    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    const fallbackToMainThread = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        reject(new Error('이미지 처리 시간이 초과되었습니다. 다른 사진으로 다시 시도해주세요.'));
        return;
      }
      if (dimensions.width * dimensions.height > MAX_MAIN_THREAD_IMAGE_PIXELS) {
        reject(new Error('이미지 처리 작업이 중단되었습니다. 사진 크기를 줄여 다시 시도해주세요.'));
        return;
      }
      void compressOnMainThreadWithTimeout(file, {
        maxDimension,
        quality,
        mimeType,
        maxSizeMB,
        timeoutMs: remainingMs,
        signal,
        onProgress,
      }).then(resolve, reject);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish(() => reject(new Error('이미지 처리 작업이 중단되었습니다. 사진 크기를 줄여 다시 시도해주세요.')));
    };
    worker.onmessageerror = fallbackToMainThread;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(Math.max(0, Math.min(100, message.progress)));
        return;
      }
      if (message.type === 'error') {
        finish(() => reject(new Error(message.message || '이미지 압축에 실패했습니다.')));
        return;
      }

      const outputType = message.blob.type;
      if (outputType !== 'image/webp' && outputType !== 'image/jpeg') {
        finish(() => reject(new Error('지원하지 않는 이미지 출력 형식입니다.')));
        return;
      }
      const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      const compressed = new File([message.blob], `${base}.${ext}`, {
        type: outputType,
        lastModified: Date.now(),
      });
      if (compressed.size <= 0 || compressed.size > maxSizeMB * 1024 * 1024 * 1.08) {
        finish(() => reject(new Error('이미지를 충분히 줄이지 못했습니다. 다른 사진으로 다시 시도해주세요.')));
        return;
      }
      onProgress?.(100);
      finish(() => resolve(compressed));
    };

    try {
      worker.postMessage({
        file,
        maxDimension,
        quality,
        mimeType,
        maxBytes: Math.round(maxSizeMB * 1024 * 1024),
        sourceWidth: dimensions.width,
        sourceHeight: dimensions.height,
      });
    } catch {
      // 일부 구형 WebView는 File structured-clone만 실패한다. Canvas 경로는 쓸 수
      // 있으므로 전체 제한 시간의 남은 범위 안에서 메인 스레드 처리를 한 번 시도한다.
      fallbackToMainThread();
    }
  });
}

/**
 * Canvas API 자체는 AbortSignal을 받지 않으므로 작업 Promise와 abort Promise를 경쟁시킨다.
 * timeout 뒤에도 이미 실행 중인 디코드/toBlob 콜백은 브라우저가 반환할 때까지 남을 수
 * 있지만, 호출자는 즉시 실패하고 후속 단계는 결합 signal 검사에서 중단된다.
 */
async function compressOnMainThreadWithTimeout(
  file: File,
  options: Required<Pick<CompressImageOptions, 'maxDimension' | 'quality' | 'mimeType' | 'maxSizeMB' | 'timeoutMs'>> &
    Pick<CompressImageOptions, 'signal' | 'onProgress'>,
): Promise<File> {
  const { timeoutMs, signal, ...compressOptions } = options;
  const controller = new AbortController();
  const forwardAbort = () => {
    if (!controller.signal.aborted) controller.abort(signal?.reason ?? abortError());
  };
  signal?.addEventListener('abort', forwardAbort, { once: true });
  if (signal?.aborted) forwardAbort();

  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new Error('이미지 처리 시간이 초과되었습니다. 다른 사진으로 다시 시도해주세요.'));
    }
  }, Math.max(1, timeoutMs));

  let rejectOnAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(controller.signal.reason ?? abortError());
    if (controller.signal.aborted) rejectOnAbort();
    else controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });

  try {
    return await Promise.race([
      compressOnMainThread(file, { ...compressOptions, signal: controller.signal }),
      aborted,
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
    if (rejectOnAbort) controller.signal.removeEventListener('abort', rejectOnAbort);
  }
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/** createImageBitmap이 없는 구형 Safari에서는 취소 가능한 <img> 디코드로 폴백한다. */
async function decodeImageOnMainThread(file: File, signal?: AbortSignal): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      if (signal?.aborted) {
        bitmap.close();
        throw signal.reason ?? abortError();
      }
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      // 지원하지 않는 코덱/브라우저 구현이면 아래 <img> 디코드를 한 번 더 시도한다.
    }
  }

  if (signal?.aborted) throw signal.reason ?? abortError();
  return new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let settled = false;

    const detach = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', handleAbort);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      detach();
      image.src = '';
      URL.revokeObjectURL(url);
      reject(error);
    };
    const handleAbort = () => fail(signal?.reason ?? abortError());

    image.onload = () => {
      if (settled) return;
      if (signal?.aborted) {
        handleAbort();
        return;
      }
      settled = true;
      detach();
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => fail(new Error('지원하지 않는 이미지 형식입니다. JPG, PNG 또는 WebP로 변환해주세요.'));
    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    image.src = url;
  });
}

/** Safari 구버전 등 OffscreenCanvas Worker 미지원 브라우저용 제한적 폴백. */
async function compressOnMainThread(
  file: File,
  options: Required<Pick<CompressImageOptions, 'maxDimension' | 'quality' | 'mimeType' | 'maxSizeMB'>> &
    Pick<CompressImageOptions, 'signal' | 'onProgress'>,
): Promise<File> {
  const { maxDimension, quality, mimeType, maxSizeMB, signal, onProgress } = options;
  if (signal?.aborted) throw signal.reason ?? abortError();
  onProgress?.(5);

  const decoded = await decodeImageOnMainThread(file, signal);

  try {
    if (signal?.aborted) throw signal.reason ?? abortError();
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * scale));
    let height = Math.max(1, Math.round(decoded.height * scale));
    let currentQuality = quality;
    let outputMimeType: 'image/jpeg' | 'image/webp' = mimeType;
    const maxBytes = maxSizeMB * 1024 * 1024;

    for (let attempt = 0; attempt < 6; attempt++) {
      if (signal?.aborted) throw signal.reason ?? abortError();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (signal?.aborted) throw signal.reason ?? abortError();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('이미지 처리 기능을 사용할 수 없습니다.');
      if (outputMimeType === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(decoded.source, 0, 0, width, height);
      let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputMimeType, currentQuality));
      if (blob && blob.type !== outputMimeType) {
        if (outputMimeType !== 'image/webp') throw new Error('지원하지 않는 이미지 출력 형식입니다.');
        outputMimeType = 'image/jpeg';
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputMimeType, currentQuality));
        if (blob && blob.type !== outputMimeType) throw new Error('지원하지 않는 이미지 출력 형식입니다.');
      }
      canvas.width = 1;
      canvas.height = 1;
      if (signal?.aborted) throw signal.reason ?? abortError();
      if (!blob) throw new Error('이미지 압축에 실패했습니다.');
      onProgress?.(20 + attempt * 13);
      if (blob.size <= maxBytes) {
        const ext = outputMimeType === 'image/webp' ? 'webp' : 'jpg';
        onProgress?.(100);
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: outputMimeType });
      }
      currentQuality = Math.max(0.55, currentQuality - 0.08);
      if (currentQuality <= 0.58) {
        const longSide = Math.max(width, height);
        const nextLongSide = Math.max(480, Math.round(longSide * 0.86));
        const resizeScale = Math.min(1, nextLongSide / longSide);
        width = Math.max(1, Math.round(width * resizeScale));
        height = Math.max(1, Math.round(height * resizeScale));
      }
    }
    throw new Error('이미지를 충분히 줄이지 못했습니다.');
  } finally {
    decoded.cleanup();
  }
}
