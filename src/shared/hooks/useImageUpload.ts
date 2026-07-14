'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatUploadStatus,
  isAbortError,
  uploadOptimizedImage,
  type UploadProgress,
} from '@/shared/utils/upload';
import { uploadOptimizedImageToEndpoint } from '@/shared/utils/uploadEndpoint';
import { MAX_IMAGE_INPUT_BYTES } from '@/shared/utils/image';

const IMAGE_QUEUE_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22500%22 viewBox=%220 0 800 500%22%3E%3Crect width=%22800%22 height=%22500%22 fill=%22%23f3f4f6%22/%3E%3Cpath d=%22M315 285l62-70 52 58 34-39 72 83H280z%22 fill=%22%23d1d5db%22/%3E%3Ccircle cx=%22463%22 cy=%22185%22 r=%2224%22 fill=%22%23d1d5db%22/%3E%3C/svg%3E';

interface UseImageUploadOptions {
  initialPath: string | null;
  initialUrl: string | null;
  bucket: string;
  buildPath: (compressed: File) => string;
  maxDimension?: number;
  maxSizeMB?: number;
  quality?: number;
  /** Supabase 세션 대신 서버 쿠키 권한으로 올려야 할 때 사용하는 same-origin API. */
  uploadEndpoint?: string;
}

/** 대표 이미지 한 장의 preview/압축/업로드/교체 취소를 일관되게 관리한다. */
export function useImageUpload(options: UseImageUploadOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [path, setPathState] = useState<string | null>(options.initialPath);
  const pathRef = useRef<string | null>(options.initialPath);
  const [preview, setPreviewState] = useState<string | null>(options.initialUrl);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const pendingRef = useRef<Promise<string | null> | null>(null);

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const setPath = useCallback((next: string | null) => {
    pathRef.current = next;
    setPathState(next);
  }, []);

  const showRemotePreview = useCallback((url: string | null) => {
    revokePreview();
    setPreviewState(url);
  }, [revokePreview]);

  const selectFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_INPUT_BYTES) {
      setError('이미지는 비어 있지 않은 30MB 이하 파일만 업로드할 수 있습니다.');
      return;
    }
    const requestId = ++requestIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const previousPath = pathRef.current;
    const previousUrl = previousPath
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${optionsRef.current.bucket}/${previousPath}`
      : null;

    revokePreview();
    // 원본 blob을 <img>에 바로 넣으면 파일 용량이 작아도 초고해상도 디코드로
    // 모바일 탭이 종료될 수 있다. 즉시 자리표시자를 보여주고 압축본으로 교체한다.
    setPreviewState(IMAGE_QUEUE_PLACEHOLDER);
    setError(null);
    setUploading(true);
    setProgress({ phase: 'compressing', percent: 1 });

    let retainFailedPromise = false;
    const pending = (async (): Promise<string | null> => {
      try {
        const current = optionsRef.current;
        const progressHandler = (next: UploadProgress) => {
          if (requestId === requestIdRef.current) setProgress(next);
        };
        const compressedPreviewHandler = (compressed: File) => {
          if (requestId !== requestIdRef.current || controller.signal.aborted) return;
          revokePreview();
          const optimizedUrl = URL.createObjectURL(compressed);
          objectUrlRef.current = optimizedUrl;
          setPreviewState(optimizedUrl);
        };
        const result = current.uploadEndpoint
          ? await uploadOptimizedImageToEndpoint(file, {
              endpoint: current.uploadEndpoint,
              maxDimension: current.maxDimension,
              maxSizeMB: current.maxSizeMB,
              quality: current.quality,
              signal: controller.signal,
              onUploadProgress: progressHandler,
              onCompressedPreview: compressedPreviewHandler,
            })
          : await uploadOptimizedImage(file, {
              bucket: current.bucket,
              buildPath: current.buildPath,
              maxDimension: current.maxDimension,
              maxSizeMB: current.maxSizeMB,
              quality: current.quality,
              signal: controller.signal,
              onUploadProgress: progressHandler,
              onCompressedPreview: compressedPreviewHandler,
            });
        if (requestId !== requestIdRef.current) return pathRef.current;
        // callback이 지원되지 않는 구현에서도 최종 압축본만 미리보기로 사용한다.
        if (!objectUrlRef.current) compressedPreviewHandler(result.file);
        setPath(result.path);
        return result.path;
      } catch (uploadError) {
        if (requestId !== requestIdRef.current || isAbortError(uploadError)) return pathRef.current;
        const message = uploadError instanceof Error ? uploadError.message : '이미지 업로드에 실패했습니다.';
        setError(message);
        showRemotePreview(previousUrl);
        setPath(previousPath);
        retainFailedPromise = true;
        // 화면은 기존 사진으로 복구하되 저장 대기자에게는 실패를 전달한다.
        // 성공으로 resolve하면 사용자는 새 사진이 저장된 줄 알고 페이지를 떠나게 된다.
        throw uploadError instanceof Error ? uploadError : new Error(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setUploading(false);
          setProgress(null);
          controllerRef.current = null;
          // 실패를 사용자가 확인하기 전에 저장 버튼을 누르더라도 누락된 새 사진으로
          // 저장되지 않게 reject 상태를 다음 선택/삭제까지 보존한다.
          if (!retainFailedPromise) pendingRef.current = null;
        }
      }
    })();
    pendingRef.current = pending;
    // 파일 선택 시점에는 호출자가 await하지 않으므로 전역 unhandled rejection은 막고,
    // waitForUpload가 같은 원본 Promise를 기다릴 때는 reject 상태를 그대로 전달한다.
    void pending.catch(() => undefined);
  }, [revokePreview, setPath, showRemotePreview]);

  const remove = useCallback(() => {
    requestIdRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingRef.current = null;
    setUploading(false);
    setProgress(null);
    setError(null);
    setPath(null);
    showRemotePreview(null);
  }, [setPath, showRemotePreview]);

  const waitForUpload = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return pathRef.current;
    try {
      return await pending;
    } catch (uploadError) {
      // 실패 직후 첫 저장은 명확히 막아 새 사진이 반영된 것처럼 보이지 않게 한다.
      // 그 오류를 사용자가 확인한 다음 저장에서는 복구된 기존 사진/path로 진행해
      // 텍스트 수정까지 영구 잠기는 일을 막는다.
      if (pendingRef.current === pending) pendingRef.current = null;
      throw uploadError;
    }
  }, []);

  const setExisting = useCallback((nextPath: string | null, nextUrl: string | null) => {
    setPath(nextPath);
    showRemotePreview(nextUrl);
  }, [setPath, showRemotePreview]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingRef.current = null;
    revokePreview();
  }, [revokePreview]);

  return {
    path,
    preview,
    uploading,
    progress,
    statusText: formatUploadStatus(progress),
    error,
    selectFile,
    remove,
    waitForUpload,
    setExisting,
    clearError: () => setError(null),
  };
}
