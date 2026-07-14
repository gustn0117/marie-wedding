/// <reference lib="webworker" />

interface CompressRequest {
  file: File;
  maxDimension: number;
  quality: number;
  mimeType: 'image/jpeg' | 'image/webp';
  maxBytes: number;
  sourceWidth: number;
  sourceHeight: number;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
const MAX_SAFE_UNRESIZED_PIXELS = 12_000_000;

async function supportsBitmapResize(): Promise<boolean> {
  try {
    const canvas = new OffscreenCanvas(2, 2);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const probe = await createImageBitmap(blob, {
      resizeWidth: 1,
      resizeHeight: 1,
      resizeQuality: 'low',
    });
    const supported = probe.width === 1 && probe.height === 1;
    probe.close();
    return supported;
  } catch {
    return false;
  }
}

scope.onmessage = async (event: MessageEvent<CompressRequest>) => {
  const { file, maxDimension, quality, mimeType, maxBytes, sourceWidth, sourceHeight } = event.data;
  let bitmap: ImageBitmap | null = null;
  try {
    scope.postMessage({ type: 'progress', progress: 5 });
    const sourceScale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const resize = sourceScale < 1
      ? sourceWidth >= sourceHeight
        ? { resizeWidth: Math.max(1, Math.round(sourceWidth * sourceScale)) }
        : { resizeHeight: Math.max(1, Math.round(sourceHeight * sourceScale)) }
      : {};
    const canResizeDuringDecode = sourceScale >= 1 || await supportsBitmapResize();
    if (!canResizeDuringDecode && sourceWidth * sourceHeight > MAX_SAFE_UNRESIZED_PIXELS) {
      throw new Error('이 브라우저에서는 고해상도 사진을 안전하게 처리할 수 없습니다. 사진 크기를 줄여 다시 시도해주세요.');
    }
    if (canResizeDuringDecode) {
      // 디코더 단계에서 축소해 고해상도 원본 전체 픽셀 버퍼를 먼저 만들지 않는다.
      bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
        resizeQuality: 'high',
        ...resize,
      });
    } else {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    }
    // WebIDL 옵션을 조용히 무시하는 구현도 있으므로 결과 크기로 한 번 더 확인한다.
    if (sourceScale < 1
        && bitmap.width * bitmap.height > MAX_SAFE_UNRESIZED_PIXELS) {
      throw new Error('이 브라우저에서는 고해상도 사진을 안전하게 처리할 수 없습니다. 사진 크기를 줄여 다시 시도해주세요.');
    }
    scope.postMessage({ type: 'progress', progress: 18 });

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    let currentQuality = quality;
    let output: Blob | null = null;
    let outputMimeType: 'image/jpeg' | 'image/webp' = mimeType;

    for (let attempt = 0; attempt < 7; attempt++) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d', { alpha: outputMimeType !== 'image/jpeg' });
      if (!ctx) throw new Error('이미지 캔버스를 만들 수 없습니다.');
      if (outputMimeType === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      output = await canvas.convertToBlob({ type: outputMimeType, quality: currentQuality });
      if (output.type !== outputMimeType) {
        if (outputMimeType !== 'image/webp') throw new Error('지원하지 않는 이미지 출력 형식입니다.');
        // 일부 Safari/WebView는 WebP 요청을 PNG로 조용히 대체한다. 이 경우 확장자와
        // 실제 바이트가 어긋나지 않도록 흰 배경 JPEG로 명시적으로 다시 인코딩한다.
        outputMimeType = 'image/jpeg';
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        output = await canvas.convertToBlob({ type: outputMimeType, quality: currentQuality });
        if (output.type !== outputMimeType) throw new Error('지원하지 않는 이미지 출력 형식입니다.');
      }
      scope.postMessage({ type: 'progress', progress: 25 + attempt * 10 });
      if (output.size <= maxBytes) break;

      currentQuality = Math.max(0.52, currentQuality - 0.08);
      if (currentQuality <= 0.56) {
        // 각 축에 480px 하한을 따로 적용하면 세로 사진·파노라마 비율이 깨진다.
        // 긴 변만 480px 아래로 내려가지 않게 하고 두 축에 같은 배율을 쓴다.
        const longSide = Math.max(width, height);
        const nextLongSide = Math.max(480, Math.round(longSide * 0.84));
        const resizeScale = Math.min(1, nextLongSide / longSide);
        width = Math.max(1, Math.round(width * resizeScale));
        height = Math.max(1, Math.round(height * resizeScale));
      }
    }

    if (!output || output.size <= 0 || output.size > maxBytes * 1.08) {
      // 정상 인코딩을 반복했지만 목표 용량에 도달하지 못한 것은 main-thread에서
      // 다시 실행해도 같으므로 폴백하지 않는다.
      throw new Error('이미지를 목표 용량으로 줄이지 못했습니다.');
    }
    scope.postMessage({ type: 'progress', progress: 100 });
    scope.postMessage({ type: 'done', blob: output });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : '이미지 처리에 실패했습니다.',
      recoverable: false,
    });
  } finally {
    bitmap?.close();
  }
};

export {};
