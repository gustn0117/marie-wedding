/**
 * 이미지 파일을 리사이즈/압축한 File 반환.
 *
 * 설계 원칙 (절대 멈추지 않게):
 *  - createImageBitmap 으로 디코드(빠름·저메모리) → canvas 리사이즈 → toBlob.
 *  - 전체를 하드 타임아웃(기본 10초)으로 감싼다. 초과하면 원본을 그대로 반환한다.
 *  - 디코드 실패(HEIC 미지원 브라우저 등)·컨텍스트 없음 등 어떤 실패에도 원본 반환.
 *  - 버킷 크기 제한은 넉넉(50MB)하므로, 압축이 안 되면 원본이라도 업로드되게 한다.
 *  - 외부 워커 라이브러리 미사용(일부 기기에서 워커가 멈추는 문제 회피).
 */
export async function compressImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    /** 하드 타임아웃(ms). 이 시간 넘으면 원본 반환. 기본 10초. */
    timeoutMs?: number;
  } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.85, mimeType = 'image/jpeg', timeoutMs = 10000 } = options;

  if (!file.type.startsWith('image/')) return file;

  try {
    return await Promise.race([
      doCompress(file, maxDimension, quality, mimeType),
      new Promise<File>((resolve) => setTimeout(() => resolve(file), timeoutMs)),
    ]);
  } catch (err) {
    console.warn('[compressImage] 실패 → 원본 사용:', err);
    return file;
  }
}

async function doCompress(
  file: File,
  maxDimension: number,
  quality: number,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<File> {
  // 1) 디코드 — createImageBitmap 우선(빠름), 실패 시 <img> 폴백
  let width: number;
  let height: number;
  let source: CanvasImageSource;
  let cleanup: (() => void) | undefined;

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
      cleanup = () => bitmap.close?.();
    } catch {
      return file; // 디코드 불가(HEIC on Chrome 등) → 원본
    }
  } else {
    const img = await loadImgElement(file);
    if (!img) return file;
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }

  try {
    const longSide = Math.max(width, height);
    const scale = longSide > maxDimension ? maxDimension / longSide : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob || blob.size === 0) return file;

    // 압축 결과가 원본보다 크면(작은 이미지 재인코딩 등) 원본 유지
    if (blob.size >= file.size) return file;

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.${ext}`, { type: mimeType });
  } finally {
    cleanup?.();
  }
}

/** <img> 로 디코드 (createImageBitmap 미지원 폴백). 실패/지연 시 null. */
function loadImgElement(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (result: HTMLImageElement | null) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}
