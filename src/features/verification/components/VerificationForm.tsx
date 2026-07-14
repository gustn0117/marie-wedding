'use client';

import { useEffect, useRef, useState } from 'react';
import { submitVerification } from '@/features/verification/services/verificationService';
import { compressImage } from '@/shared/utils/image';

const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);

function normalizeFileType(file: File): File {
  if (file.type) return file;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const inferred: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    avif: 'image/avif',
    pdf: 'application/pdf',
  };
  const type = extension ? inferred[extension] : undefined;
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

// 사업자번호 000-00-00000 자동 하이픈
function formatBizNo(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function VerificationForm() {
  const [businessNumber, setBusinessNumber] = useState('');
  const [sourceInfo, setSourceInfo] = useState<{ name: string; size: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const selectionVersionRef = useRef(0);
  const preparePromiseRef = useRef<Promise<File | null> | null>(null);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const bizDigits = businessNumber.replace(/[^0-9]/g, '');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionVersionRef.current += 1;
      prepareAbortRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function replacePreview(url: string | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function selectDocument(rawFile: File) {
    if (busyRef.current) return;
    const selected = normalizeFileType(rawFile);
    const isImage = IMAGE_TYPES.has(selected.type);
    const isPdf = selected.type === 'application/pdf';
    const version = selectionVersionRef.current + 1;
    selectionVersionRef.current = version;
    prepareAbortRef.current?.abort();
    prepareAbortRef.current = null;
    preparePromiseRef.current = null;
    replacePreview(null);
    setSourceInfo(null);
    setFile(null);
    setPreparing(false);
    setPrepareProgress(0);
    setError(null);

    if (!isImage && !isPdf) {
      setError('JPG, PNG, WebP, HEIC 또는 PDF 파일을 선택해 주세요.');
      return;
    }
    if (selected.size <= 0) {
      setError('비어 있는 파일은 첨부할 수 없습니다.');
      return;
    }
    if (isPdf && selected.size > MAX_DOCUMENT_BYTES) {
      setError('PDF 파일은 8MB 이하로 첨부해 주세요.');
      return;
    }
    if (isImage && selected.size > MAX_SOURCE_IMAGE_BYTES) {
      setError('원본 이미지는 25MB 이하로 선택해 주세요.');
      return;
    }

    setSourceInfo({ name: selected.name, size: selected.size });

    if (isPdf) {
      setFile(selected);
      preparePromiseRef.current = Promise.resolve(selected);
      return;
    }

    setPreparing(true);
    setPrepareProgress(1);
    const controller = new AbortController();
    prepareAbortRef.current = controller;
    const task = (async (): Promise<File | null> => {
      try {
        const optimized = await compressImage(selected, {
          maxDimension: 2400,
          quality: 0.86,
          mimeType: 'image/jpeg',
          maxSizeMB: 2.5,
          signal: controller.signal,
          onProgress: (progress) => {
            if (mountedRef.current && selectionVersionRef.current === version) {
              setPrepareProgress(Math.max(0, Math.min(100, Math.round(progress))));
            }
          },
        });
        if (!mountedRef.current || selectionVersionRef.current !== version) return null;
        if (!IMAGE_TYPES.has(optimized.type)) {
          throw new Error('이 이미지 형식을 처리하지 못했습니다. JPG 또는 PDF로 다시 선택해 주세요.');
        }
        if (optimized.size > MAX_DOCUMENT_BYTES) {
          throw new Error('이미지를 8MB 이하로 최적화하지 못했습니다. 더 작은 사진을 선택해 주세요.');
        }
        // 원본은 화면에서 디코드하지 않고 실제 제출될 작은 압축본만 미리보기한다.
        replacePreview(URL.createObjectURL(optimized));
        setFile(optimized);
        setPreparing(false);
        setPrepareProgress(100);
        return optimized;
      } catch (err) {
        if (mountedRef.current && selectionVersionRef.current === version) {
          const canSubmitOriginal = !controller.signal.aborted
            && ['image/heic', 'image/heif', 'image/avif'].includes(selected.type)
            && selected.size <= MAX_DOCUMENT_BYTES;
          // Chrome처럼 HEIC 디코더가 없는 환경에서도, 서버 magic-byte 검증을
          // 통과할 8MB 이하 비공개 인증 서류는 원본으로 제출할 수 있게 한다.
          if (canSubmitOriginal) {
            setFile(selected);
            setPreparing(false);
            setPrepareProgress(100);
            return selected;
          }
          replacePreview(null);
          setFile(null);
          setPreparing(false);
          setError(err instanceof Error ? err.message : '이미지를 준비하지 못했습니다.');
        }
        return null;
      } finally {
        if (prepareAbortRef.current === controller) prepareAbortRef.current = null;
      }
    })();
    preparePromiseRef.current = task;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    if (bizDigits.length !== 10) { setError('사업자번호 10자리를 정확히 입력해 주세요.'); return; }
    const preparePromise = preparePromiseRef.current;
    if (!sourceInfo || !preparePromise) { setError('사업자등록증 파일을 첨부해 주세요.'); return; }

    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const selectionVersion = selectionVersionRef.current;
      const doc = await preparePromise;
      if (!mountedRef.current) return;
      if (selectionVersionRef.current !== selectionVersion) {
        setError('첨부 파일이 변경되었습니다. 다시 신청해 주세요.');
        return;
      }
      if (!doc) {
        setError('첨부 파일을 준비하지 못했습니다. 다른 파일로 다시 시도해 주세요.');
        return;
      }

      const result = await submitVerification({ businessNumber, documentFile: doc });
      if (!mountedRef.current) return;
      if (!result.ok) { setError(result.error); return; }
      replacePreview(null);
      preparePromiseRef.current = null;
      setFile(null);
      setSourceInfo(null);
      setDone(true);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : '신청에 실패했습니다.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900">신청이 접수되었습니다</p>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          관리자 검토 후 알림으로 결과를 알려드립니다.<br />
          승인되면 프로필과 카드에 <span className="font-semibold text-primary">인증 배지</span>가 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 안내 */}
      <div className="rounded-lg bg-secondary-50 border border-gray-100 p-4">
        <p className="text-sm font-bold text-gray-900 mb-2">인증하면 이렇게 달라져요</p>
        <ul className="space-y-1.5 text-[13px] text-gray-600">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            프로필·업체 카드·공고에 <span className="font-semibold text-gray-800">인증 배지</span> 노출
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            지원자·구직자에게 <span className="font-semibold text-gray-800">신뢰도</span> 상승
          </li>
        </ul>
      </div>

      {/* 사업자번호 */}
      <div>
        <label htmlFor="bizno" className="block text-sm font-bold mb-2 text-gray-900">
          사업자등록번호 <span className="text-state-urgent">*</span>
        </label>
        <input
          id="bizno"
          type="text"
          inputMode="numeric"
          value={businessNumber}
          onChange={(e) => { setBusinessNumber(formatBizNo(e.target.value)); if (error) setError(null); }}
          placeholder="000-00-00000"
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm tracking-wide focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        <p className="text-xs text-gray-500 mt-1.5">숫자 10자리. 등록증 이미지의 번호와 일치해야 합니다.</p>
      </div>

      {/* 파일 첨부 (드롭존) */}
      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">
          사업자등록증 사본 <span className="text-state-urgent">*</span>
        </label>
        <label
          htmlFor="bizdoc"
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
            sourceInfo ? 'border-primary bg-primary-50/40' : 'border-gray-300 hover:border-primary hover:bg-secondary-50'
          }`}
        >
          {sourceInfo ? (
            <>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="사업자등록증 미리보기" className="max-h-40 max-w-full rounded border border-gray-200 bg-white object-contain" />
              ) : (
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              )}
              <span className="text-sm font-semibold text-gray-900 break-all text-center">{sourceInfo.name}</span>
              <span className={`text-xs ${!preparing && !file ? 'text-rose-600' : 'text-gray-500'}`} aria-live="polite">
                {preparing
                  ? `${formatSize(sourceInfo.size)} · 업로드용으로 최적화 중 ${prepareProgress}%…`
                  : !file
                    ? `${formatSize(sourceInfo.size)} · 준비 실패`
                  : file && file.size < sourceInfo.size
                    ? `${formatSize(sourceInfo.size)} → ${formatSize(file.size)}로 준비 완료`
                    : `${formatSize(file?.size ?? sourceInfo.size)} · 준비 완료`}
                {' · 다른 파일로 변경하려면 클릭'}
              </span>
            </>
          ) : (
            <>
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
              <span className="text-sm font-semibold text-gray-700">이미지 또는 PDF 첨부</span>
              <span className="text-xs text-gray-500">JPG · PNG · WebP · HEIC · PDF / 제출 파일 8MB 이하</span>
            </>
          )}
          <input
            id="bizdoc"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,application/pdf"
            onChange={(e) => {
              const selected = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (selected) selectDocument(selected);
            }}
            disabled={busy}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-1.5">이미지는 선택 즉시 자동 최적화됩니다. 주민등록번호 등 민감 정보는 업로드 전 가려주세요.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-state-urgent-bg border border-red-200 px-3.5 py-2.5 text-sm text-state-urgent">{error}</div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full min-h-[46px] disabled:opacity-50"
      >
        {busy ? (preparing ? '서류 준비 중…' : '안전하게 제출 중…') : '인증 신청하기'}
      </button>
      <p className="text-center text-xs text-gray-400">검토는 영업일 기준 1~3일 소요됩니다.</p>
    </form>
  );
}
