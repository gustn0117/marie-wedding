import imageCompression from 'browser-image-compression';

/**
 * 이미지 파일을 리사이즈/압축한 File 반환.
 *
 * 1차: browser-image-compression (웹 워커) — 메인스레드를 막지 않아 대용량 사진도
 *      빠르고 UI 프리즈 없이 처리. maxSizeMB 로 목표 크기까지 반복 압축.
 * 2차(폴백): 라이브러리 실패(HEIC 디코드 불가 브라우저 등) 시 canvas 방식.
 *
 * 크기 제한은 두지 않는다 — 큰 이미지가 와도 거부 대신 압축해서 업로드.
 */
export async function compressImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
    /** 목표 최대 용량(MB). 이 이하가 될 때까지 반복 압축. 기본 1MB. */
    maxSizeMB?: number;
  } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.85, mimeType = 'image/jpeg', maxSizeMB = 1 } = options;

  if (!file.type.startsWith('image/')) return file;

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';

  try {
    // 워커 압축 — 15초 안에 못 끝내면(worker 문제 등) 폴백. 무한 대기 방지.
    const compressed = await Promise.race([
      imageCompression(file, {
        maxWidthOrHeight: maxDimension,
        initialQuality: quality,
        maxSizeMB,
        useWebWorker: true,
        fileType: mimeType,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('compress_timeout')), 15000)),
    ]);
    // 결과 검증 — 비어있거나 원본보다 크면 canvas 폴백
    if (compressed && compressed.size > 0 && compressed.size <= file.size * 1.05) {
      return new File([compressed], `${base}.${ext}`, { type: compressed.type || mimeType });
    }
    console.warn('[compressImage] 워커 결과 비정상, canvas 폴백');
    return canvasCompress(file, { maxDimension, quality, mimeType });
  } catch (err) {
    console.warn('[compressImage] 워커 압축 실패, canvas 폴백:', err);
    return canvasCompress(file, { maxDimension, quality, mimeType });
  }
}

/** 폴백: canvas 기반 리사이즈/압축 (메인스레드). */
function canvasCompress(
  file: File,
  options: { maxDimension: number; quality: number; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
): Promise<File> {
  const { maxDimension, quality, mimeType } = options;

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    // HEIC/AVIF/손상 이미지로 onload가 안 불리는 경우 원본 fallback + 12초 안전망
    const safety = setTimeout(() => resolve(file), 12000);
    img.onerror = () => { clearTimeout(safety); resolve(file); };
    reader.onerror = () => { clearTimeout(safety); resolve(file); };

    reader.onload = (e) => {
      img.onload = () => {
        clearTimeout(safety);
        let { width, height } = img;
        const longSide = Math.max(width, height);

        if (longSide <= maxDimension) {
          resolve(file);
          return;
        }

        const scale = maxDimension / longSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
            const base = file.name.replace(/\.[^.]+$/, '');
            resolve(new File([blob], `${base}.${ext}`, { type: mimeType }));
          },
          mimeType,
          quality
        );
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
