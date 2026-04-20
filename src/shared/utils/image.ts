/**
 * 이미지 파일을 리사이즈/압축한 Blob 반환.
 * - 긴 변이 maxDimension보다 크면 축소
 * - JPEG는 quality로 압축
 * - 이미 작으면 원본 반환
 */
export async function compressImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  } = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.85, mimeType = 'image/jpeg' } = options;

  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        const longSide = Math.max(width, height);

        if (longSide <= maxDimension) {
          // 충분히 작으면 원본 반환
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
