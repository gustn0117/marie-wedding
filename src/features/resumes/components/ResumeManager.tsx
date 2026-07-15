'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/shared/utils/apiFetch';
import { useImageUpload } from '@/shared/hooks/useImageUpload';
import ImageUploadHint from '@/shared/components/ImageUploadHint';
import { resolveResumePhotoUrl } from '@/features/resumes/lib/photo';
import { toast, toastConfirm } from '@/shared/components/Toast';
import ResumePreview from '@/features/resumes/components/ResumePreview';
import SmartDate from '@/shared/components/SmartDate';
import {
  RESUME_LANGUAGE_LEVEL_LABELS,
  calculateResumeCompleteness,
  isResumeContentSubmittable,
  isValidResumeEmail,
  isValidResumePhone,
  type ResumeCertificate,
  type ResumeContent,
  type ResumeEducation,
  type ResumeExperience,
  type ResumeLanguage,
  type ResumeLink,
  type ResumeRecord,
} from '@/features/resumes/types';

// 완성도 배점(calculateResumeCompleteness)과 1:1로 대응하는 체크리스트 —
// "무엇을 채우면 제출 가능한지"를 사용자에게 그대로 보여준다.
function completenessItems(r: ResumeContent): { label: string; done: boolean; points: number; required?: boolean }[] {
  const contactOk = isValidResumeEmail(r.email) || isValidResumePhone(r.phone);
  return [
    { label: '이름', done: !!r.fullName.trim(), points: 10, required: true },
    { label: '증명사진', done: !!r.photoPath, points: 10 },
    { label: '연락처 또는 이메일', done: contactOk, points: 10 },
    { label: '한 줄 소개', done: !!r.headline.trim(), points: 10 },
    { label: '자기소개 30자 이상', done: r.summary.trim().length >= 30, points: 20 },
    { label: '학력 1개 이상', done: r.educations.some((e) => e.school.trim()), points: 15 },
    { label: '경력 1개 이상', done: r.experiences.some((e) => e.company.trim() && e.position.trim()), points: 15 },
    { label: '자격증 또는 기술', done: r.certificates.some((c) => c.name.trim()) || r.skills.length > 0, points: 5 },
    { label: '희망 직무', done: r.desiredRoles.length > 0, points: 5 },
  ];
}

interface ResumeManagerProps {
  initialResumes: ResumeRecord[];
  userId: string;
}

function cloneResume(resume: ResumeRecord): ResumeRecord {
  return structuredClone(resume);
}

function newEducation(): ResumeEducation {
  return { id: crypto.randomUUID(), school: '', major: '', degree: 'bachelor', startDate: '', endDate: '', isCurrent: false, description: '' };
}

function newExperience(): ResumeExperience {
  return { id: crypto.randomUUID(), company: '', position: '', startDate: '', endDate: '', isCurrent: false, description: '' };
}

function newCertificate(): ResumeCertificate {
  return { id: crypto.randomUUID(), name: '', issuer: '', acquiredDate: '', credentialId: '' };
}

function newLanguage(): ResumeLanguage {
  return { id: crypto.randomUUID(), language: '', level: 'conversational', testName: '', score: '' };
}

function newLink(): ResumeLink {
  return { id: crypto.randomUUID(), label: '', url: '' };
}

export default function ResumeManager({ initialResumes, userId }: ResumeManagerProps) {
  const searchParams = useSearchParams();
  const requestedResumeId = searchParams.get('resumeId');
  const initial = initialResumes.find((resume) => resume.id === requestedResumeId)
    ?? initialResumes.find((resume) => resume.isDefault)
    ?? initialResumes[0]
    ?? null;
  const [resumes, setResumes] = useState(initialResumes);
  const [draft, setDraft] = useState<ResumeRecord | null>(initial ? cloneResume(initial) : null);
  const selectedIdRef = useRef(initial?.id ?? 'new');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const operationRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawNext = searchParams.get('next');
  const uuidPart = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  const nextHref = rawNext && new RegExp(`^/jobs/${uuidPart}(?:\\?resumeId=${uuidPart})?#apply$`, 'i').test(rawNext)
    ? rawNext
    : null;

  const imageUpload = useImageUpload({
    initialPath: initial?.photoPath ?? null,
    initialUrl: resolveResumePhotoUrl(initial?.photoPath),
    bucket: 'resume-files',
    uploadEndpoint: draft ? `/api/resumes/photo?resumeId=${encodeURIComponent(draft.id)}` : '/api/resumes/photo',
    maxDimension: 800,
    maxSizeMB: 0.55,
    quality: 0.84,
    buildPath: (compressed) => `${userId}/resume/${crypto.randomUUID()}.${compressed.name.split('.').pop() || 'webp'}`,
  });

  const previewData = useMemo(() => {
    if (!draft) return null;
    return { ...draft, photoPath: imageUpload.path } as ResumeRecord;
  }, [draft, imageUpload.path]);
  const liveCompleteness = previewData ? calculateResumeCompleteness(previewData) : 0;
  const submissionReady = !!previewData && isResumeContentSubmittable(previewData, liveCompleteness);
  const busy = saving || creating || deleting;

  useEffect(() => {
    if (!dirty) return;
    const message = '저장하지 않은 이력서 변경사항이 있습니다. 페이지를 떠날까요?';
    const currentUrl = window.location.href;
    const guardToken = crypto.randomUUID();
    let allowExit = false;
    let pendingNavigation: string | null = null;
    const currentHistoryState = window.history.state && typeof window.history.state === 'object'
      ? window.history.state as Record<string, unknown>
      : {};
    // 첫 뒤로가기는 실제 이전 화면이 아니라 URL이 같은 이 guard entry만
    // 제거한다. Next 라우터가 우리 listener보다 먼저 popstate를 받아도 같은
    // 화면을 복원하므로 편집 컴포넌트와 draft가 사라지지 않는다.
    window.history.pushState({ ...currentHistoryState, __marieResumeGuard: guardToken }, '', currentUrl);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExit) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const guardInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (window.history.state?.__marieResumeGuard === guardToken) {
        event.preventDefault();
        event.stopImmediatePropagation();
        allowExit = true;
        pendingNavigation = anchor.href;
        window.history.back();
      } else {
        allowExit = true;
      }
    };
    const guardHistoryNavigation = () => {
      if (allowExit) {
        if (pendingNavigation) {
          const href = pendingNavigation;
          pendingNavigation = null;
          window.location.assign(href);
        }
        return;
      }
      if (window.confirm(message)) {
        allowExit = true;
        // 현재 pop은 같은 URL의 guard entry만 제거했다. 한 번 더 이동해야
        // 실제 이전 페이지로 나가며, 두 번째 pop은 위 allowExit 분기로 통과한다.
        window.history.back();
        return;
      }
      const restoredState = window.history.state && typeof window.history.state === 'object'
        ? window.history.state as Record<string, unknown>
        : currentHistoryState;
      window.history.pushState({ ...restoredState, __marieResumeGuard: guardToken }, '', currentUrl);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardInternalLink, true);
    window.addEventListener('popstate', guardHistoryNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardInternalLink, true);
      window.removeEventListener('popstate', guardHistoryNavigation, true);
      // 저장 완료처럼 화면에 그대로 남아 dirty만 해제된 경우, 뒤로가기를
      // 두 번 눌러야 하는 가짜 entry를 조용히 제거한다.
      if (!allowExit && window.history.state?.__marieResumeGuard === guardToken) {
        window.history.back();
      }
    };
  }, [dirty]);

  function patch<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
  }

  async function selectResume(resume: ResumeRecord) {
    if (operationRef.current) return;
    if (draft?.id === resume.id) return;
    if (dirty && !(await toastConfirm('저장하지 않은 변경사항이 있습니다. 다른 이력서로 이동할까요?'))) return;
    selectedIdRef.current = resume.id;
    setDraft(cloneResume(resume));
    imageUpload.setExisting(resume.photoPath, resolveResumePhotoUrl(resume.photoPath));
    setDirty(false);
    setMode('edit');
  }

  async function createResume() {
    if (operationRef.current) return;
    if (resumes.length >= 5) {
      toast('이력서는 최대 5개까지 만들 수 있습니다.', 'error');
      return;
    }
    if (dirty && !(await toastConfirm('저장하지 않은 변경사항이 있습니다. 새 이력서를 만들까요?'))) return;
    if (operationRef.current) return;
    operationRef.current = true;
    setCreating(true);
    try {
      const response = await apiFetch('/api/resumes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, 12_000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '이력서를 만들지 못했습니다.');
      const created = body.resume as ResumeRecord;
      setResumes((current) => [created, ...current]);
      selectedIdRef.current = created.id;
      setDraft(cloneResume(created));
      imageUpload.setExisting(created.photoPath, resolveResumePhotoUrl(created.photoPath));
      setDirty(false);
      setMode('edit');
      toast('새 이력서를 만들었습니다.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '이력서를 만들지 못했습니다.', 'error');
    } finally {
      setCreating(false);
      operationRef.current = false;
    }
  }

  async function saveResume() {
    if (!draft || operationRef.current) return;
    if (!draft.title.trim()) {
      toast('이력서 제목을 입력해주세요.', 'error');
      return;
    }
    operationRef.current = true;
    setSaving(true);
    try {
      const photoPath = await imageUpload.waitForUpload();
      const payload = { ...draft, photoPath };
      const response = await apiFetch(`/api/resumes/${draft.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 15_000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '이력서를 저장하지 못했습니다.');
      const saved = body.resume as ResumeRecord;
      setResumes((current) => current
        .map((item) => item.id === saved.id ? saved : saved.isDefault ? { ...item, isDefault: false } : item)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt)));
      setDraft(cloneResume(saved));
      imageUpload.setExisting(saved.photoPath, resolveResumePhotoUrl(saved.photoPath));
      setDirty(false);
      toast('이력서를 저장했습니다.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '이력서를 저장하지 못했습니다.', 'error');
    } finally {
      setSaving(false);
      operationRef.current = false;
    }
  }

  async function deleteResume() {
    if (!draft || operationRef.current) return;
    if (!(await toastConfirm(`'${draft.title}' 이력서를 삭제할까요? 제출한 이력서 사본은 유지됩니다.`))) return;
    if (operationRef.current) return;
    operationRef.current = true;
    setDeleting(true);
    try {
      const response = await apiFetch(`/api/resumes/${draft.id}?version=${draft.version}`, { method: 'DELETE', credentials: 'include' }, 12_000);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || '이력서를 삭제하지 못했습니다.');
      const remaining = Array.isArray(body.resumes)
        ? body.resumes as ResumeRecord[]
        : resumes.filter((item) => item.id !== draft.id);
      setResumes(remaining);
      const next = remaining.find((item) => item.isDefault) ?? remaining[0] ?? null;
      selectedIdRef.current = next?.id ?? 'new';
      setDraft(next ? cloneResume(next) : null);
      imageUpload.setExisting(next?.photoPath ?? null, resolveResumePhotoUrl(next?.photoPath));
      setDirty(false);
      toast('이력서를 삭제했습니다.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '이력서를 삭제하지 못했습니다.', 'error');
    } finally {
      setDeleting(false);
      operationRef.current = false;
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <button
          type="button"
          onClick={createResume}
          disabled={busy || resumes.length >= 5}
          className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-transform group-hover:scale-105 group-disabled:group-hover:scale-100">
            {creating ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900 group-hover:text-primary">{creating ? '만드는 중…' : '새 이력서 만들기'}</span>
            <span className="block text-[11.5px] text-gray-400">{resumes.length >= 5 ? '최대 5개까지 만들 수 있어요' : `이력서 ${resumes.length}/5 · 빈 양식으로 시작`}</span>
          </span>
          <svg className="ml-auto h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>
        <div className="overflow-hidden rounded border border-gray-200 bg-white">
          {resumes.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              <p className="font-bold text-gray-800">아직 이력서가 없습니다</p>
              <p className="mt-2 text-xs leading-5">새 이력서를 만들어 채용 지원을 준비해보세요.</p>
            </div>
          ) : resumes.map((resume) => {
            const photoUrl = resolveResumePhotoUrl(resume.photoPath);
            const active = draft?.id === resume.id;
            return (
            <button
              key={resume.id}
              type="button"
              onClick={() => void selectResume(resume)}
              disabled={busy}
              className={`flex w-full gap-3 border-b border-gray-100 p-3.5 text-left last:border-b-0 transition-colors ${active ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
            >
              <div className={`h-14 w-11 shrink-0 overflow-hidden rounded border bg-gray-50 ${active ? 'border-primary/30' : 'border-gray-200'}`}>
                {photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center text-lg font-bold text-gray-300">{(resume.title || '이').charAt(0)}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className={`truncate text-sm font-bold ${active ? 'text-primary' : 'text-gray-900'}`}>{resume.title}</p>
                  {resume.isDefault && <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">대표</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${resume.completenessScore}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  완성도 {resume.completenessScore}% · {new Date(resume.updatedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 수정
                </p>
              </div>
            </button>
            );
          })}
        </div>
        <p className="px-1 text-xs leading-5 text-gray-400">최대 5개 · 지원할 때 공고에 맞는 이력서를 선택할 수 있습니다.</p>
      </aside>

      <section className="min-w-0">
        {!draft ? (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
            <p className="text-lg font-bold text-gray-800">첫 이력서를 만들어보세요</p>
            <p className="mt-2 text-sm text-gray-500">사진, 경력, 학력, 자격증을 한 번 등록하면 지원할 때 바로 제출할 수 있습니다.</p>
            <button type="button" onClick={createResume} disabled={busy} className="btn-primary mt-5 disabled:opacity-50">이력서 만들기</button>
          </div>
        ) : (
          <>
            <div className="sticky top-[calc(var(--header-h)+8px)] z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">{draft.title}</p>
                <p className={`text-xs font-semibold ${submissionReady ? 'text-primary' : 'text-amber-600'}`}>
                  완성도 {liveCompleteness}% {submissionReady ? '· 제출 가능' : !draft.fullName.trim() ? '· 이름 입력 필요' : '· 60%부터 제출 가능'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')} disabled={busy} className="btn-outline text-sm disabled:opacity-50">
                  {mode === 'edit' ? '미리보기' : '편집하기'}
                </button>
                {mode === 'edit' && <button type="button" onClick={saveResume} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{saving ? '저장 중…' : dirty ? '변경사항 저장' : '저장'}</button>}
              </div>
            </div>

            {mode === 'preview' && previewData ? (
              <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0 disabled:opacity-80">
                <ResumePreview resume={previewData} />
                <div className="flex flex-wrap justify-end gap-2">
                  {nextHref && !dirty && submissionReady && <Link href={nextHref} className="btn-primary">지원 화면으로 돌아가기</Link>}
                  <button type="button" onClick={() => window.print()} className="btn-outline">인쇄 / PDF 저장</button>
                </div>
              </fieldset>
            ) : (
              <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0 disabled:opacity-80">
                {previewData && <CompletenessChecklist resume={previewData} score={liveCompleteness} submittable={submissionReady} />}

                <FormSection title="기본 정보" description="채용 담당자가 가장 먼저 확인하는 정보입니다.">
                  <div className="grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)]">
                    <div>
                      <div className="h-44 w-36 overflow-hidden rounded border border-gray-200 bg-gray-50">
                        {imageUpload.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUpload.preview} alt="이력서 증명사진" className="h-full w-full object-cover" />
                        ) : <div className="flex h-full items-center justify-center text-3xl font-bold text-gray-300">{(draft.fullName || '?').charAt(0)}</div>}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) { imageUpload.selectFile(file); setDirty(true); }
                        event.target.value = '';
                      }} />
                      <div className="mt-2 flex gap-2 text-xs font-semibold">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary">사진 변경</button>
                        {imageUpload.preview && <button type="button" onClick={() => { imageUpload.remove(); patch('photoPath', null); }} className="text-gray-500">삭제</button>}
                      </div>
                      <ImageUploadHint ratio="증명사진 비율" recommendedSize="400 × 520px" maxSize="자동 압축" />
                      {imageUpload.uploading && <p className="mt-2 text-xs font-semibold text-primary">{imageUpload.statusText}</p>}
                      {imageUpload.error && <p className="mt-2 text-xs text-state-urgent">{imageUpload.error}</p>}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="이력서 제목" value={draft.title} onChange={(value) => patch('title', value)} maxLength={80} required />
                      <label className="flex items-center gap-2 self-end rounded border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-700">
                        <input type="checkbox" checked={draft.isDefault} onChange={(event) => { setDraft((current) => current ? { ...current, isDefault: event.target.checked } : current); setDirty(true); }} /> 대표 이력서로 사용
                      </label>
                      <TextField label="이름" value={draft.fullName} onChange={(value) => patch('fullName', value)} maxLength={80} required />
                      <TextField label="한 줄 소개" value={draft.headline} onChange={(value) => patch('headline', value)} maxLength={120} placeholder="예: 현장 대응에 강한 웨딩 플래너" />
                      <TextField label="연락처" type="tel" value={draft.phone} onChange={(value) => patch('phone', value)} maxLength={30} />
                      <TextField label="이메일" type="email" value={draft.email} onChange={(value) => patch('email', value)} maxLength={254} />
                      <DateField label="생년월일 (선택)" granularity="day" value={draft.birthDate} onChange={(value) => patch('birthDate', value)} />
                      <TextField label="거주지" value={draft.address} onChange={(value) => patch('address', value)} maxLength={200} placeholder="예: 서울시 강남구" />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="희망 조건" description="직무·지역·고용형태를 입력하고 Enter로 추가하세요.">
                  <div className="grid gap-4 md:grid-cols-3">
                    <TagInput label="희망 직무" values={draft.desiredRoles} onChange={(values) => patch('desiredRoles', values)} placeholder="웨딩 플래너" maxItems={10} maxLength={60} />
                    <TagInput label="희망 지역" values={draft.desiredRegions} onChange={(values) => patch('desiredRegions', values)} placeholder="서울" maxItems={10} maxLength={40} />
                    <TagInput label="희망 고용형태" values={draft.desiredEmploymentTypes} onChange={(values) => patch('desiredEmploymentTypes', values)} placeholder="정규직" maxItems={10} maxLength={40} />
                  </div>
                </FormSection>

                <FormSection title="자기소개" description="경험과 강점이 드러나도록 30자 이상 작성하면 완성도가 올라갑니다.">
                  <textarea aria-label="자기소개" value={draft.summary} onChange={(event) => patch('summary', event.target.value)} rows={8} maxLength={5000} className="input-field resize-y" placeholder="지원 직무와 연결되는 경험, 일하는 방식, 강점을 작성해주세요." />
                  <p className="mt-1 text-right text-xs text-gray-400">{draft.summary.length}/5000</p>
                </FormSection>

                <FormSection title="경력" description="최근 경력부터 표시됩니다." actionLabel="경력 추가" onAdd={draft.experiences.length < 20 ? () => patch('experiences', [...draft.experiences, newExperience()]) : undefined}>
                  <div className="space-y-4">
                    {draft.experiences.length === 0 && <EmptyRows label="등록된 경력이 없습니다." />}
                    {draft.experiences.map((item, index) => (
                      <RepeatCard key={item.id} title={`경력 ${index + 1}`} onRemove={() => patch('experiences', draft.experiences.filter((row) => row.id !== item.id))}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField label="회사명" value={item.company} maxLength={100} onChange={(value) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, company: value } : row))} />
                          <TextField label="직책 / 담당업무" value={item.position} maxLength={100} onChange={(value) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, position: value } : row))} />
                          <DateField label="입사 월" value={item.startDate} onChange={(value) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, startDate: value } : row))} />
                          <DateField label="퇴사 월" value={item.endDate} disabled={item.isCurrent} onChange={(value) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, endDate: value } : row))} />
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={item.isCurrent} onChange={(event) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, isCurrent: event.target.checked, endDate: event.target.checked ? '' : row.endDate } : row))} />현재 재직 중</label>
                        <textarea aria-label={`경력 ${index + 1} 설명`} value={item.description} onChange={(event) => patch('experiences', draft.experiences.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} rows={4} maxLength={2000} className="input-field mt-3 resize-y" placeholder="담당 업무와 성과를 구체적으로 적어주세요." />
                      </RepeatCard>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="학력" actionLabel="학력 추가" onAdd={draft.educations.length < 10 ? () => patch('educations', [...draft.educations, newEducation()]) : undefined}>
                  <div className="space-y-4">
                    {draft.educations.length === 0 && <EmptyRows label="등록된 학력이 없습니다." />}
                    {draft.educations.map((item, index) => (
                      <RepeatCard key={item.id} title={`학력 ${index + 1}`} onRemove={() => patch('educations', draft.educations.filter((row) => row.id !== item.id))}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField label="학교명" value={item.school} maxLength={100} onChange={(value) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, school: value } : row))} />
                          <TextField label="전공" value={item.major} maxLength={100} onChange={(value) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, major: value } : row))} />
                          <SelectField label="학위" value={item.degree} onChange={(value) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, degree: value as ResumeEducation['degree'] } : row))}><option value="high_school">고등학교</option><option value="associate">전문학사</option><option value="bachelor">학사</option><option value="master">석사</option><option value="doctorate">박사</option><option value="other">기타</option></SelectField>
                          <span />
                          <DateField label="입학 월" value={item.startDate} onChange={(value) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, startDate: value } : row))} />
                          <DateField label="졸업 월" value={item.endDate} disabled={item.isCurrent} onChange={(value) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, endDate: value } : row))} />
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={item.isCurrent} onChange={(event) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, isCurrent: event.target.checked, endDate: event.target.checked ? '' : row.endDate } : row))} />재학 중</label>
                        <textarea aria-label={`학력 ${index + 1} 설명`} value={item.description} onChange={(event) => patch('educations', draft.educations.map((row) => row.id === item.id ? { ...row, description: event.target.value } : row))} rows={3} maxLength={1000} className="input-field mt-3 resize-y" placeholder="교육 과정, 활동, 성과 등을 적어주세요." />
                      </RepeatCard>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="자격증" actionLabel="자격증 추가" onAdd={draft.certificates.length < 20 ? () => patch('certificates', [...draft.certificates, newCertificate()]) : undefined}>
                  <div className="space-y-4">
                    {draft.certificates.length === 0 && <EmptyRows label="등록된 자격증이 없습니다." />}
                    {draft.certificates.map((item, index) => (
                      <RepeatCard key={item.id} title={`자격증 ${index + 1}`} onRemove={() => patch('certificates', draft.certificates.filter((row) => row.id !== item.id))}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField label="자격증명" value={item.name} maxLength={100} onChange={(value) => patch('certificates', draft.certificates.map((row) => row.id === item.id ? { ...row, name: value } : row))} />
                          <TextField label="발급기관" value={item.issuer} maxLength={100} onChange={(value) => patch('certificates', draft.certificates.map((row) => row.id === item.id ? { ...row, issuer: value } : row))} />
                          <DateField label="취득일" granularity="day" value={item.acquiredDate} onChange={(value) => patch('certificates', draft.certificates.map((row) => row.id === item.id ? { ...row, acquiredDate: value } : row))} />
                          <TextField label="자격번호 (선택)" value={item.credentialId} maxLength={100} onChange={(value) => patch('certificates', draft.certificates.map((row) => row.id === item.id ? { ...row, credentialId: value } : row))} />
                        </div>
                      </RepeatCard>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="기술과 강점" description="업무 도구, 전문 분야, 강점을 Enter로 추가하세요.">
                  <TagInput label="기술 / 강점" values={draft.skills} onChange={(values) => patch('skills', values)} placeholder="고객 상담" maxItems={30} maxLength={50} />
                </FormSection>

                <FormSection title="외국어" actionLabel="외국어 추가" onAdd={draft.languages.length < 10 ? () => patch('languages', [...draft.languages, newLanguage()]) : undefined}>
                  <div className="space-y-4">
                    {draft.languages.length === 0 && <EmptyRows label="등록된 외국어가 없습니다." />}
                    {draft.languages.map((item, index) => (
                      <RepeatCard key={item.id} title={`외국어 ${index + 1}`} onRemove={() => patch('languages', draft.languages.filter((row) => row.id !== item.id))}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField label="언어" value={item.language} maxLength={50} onChange={(value) => patch('languages', draft.languages.map((row) => row.id === item.id ? { ...row, language: value } : row))} />
                          <SelectField label="수준" value={item.level} onChange={(value) => patch('languages', draft.languages.map((row) => row.id === item.id ? { ...row, level: value as ResumeLanguage['level'] } : row))}>{Object.entries(RESUME_LANGUAGE_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
                          <TextField label="시험명 (선택)" value={item.testName} maxLength={100} onChange={(value) => patch('languages', draft.languages.map((row) => row.id === item.id ? { ...row, testName: value } : row))} />
                          <TextField label="점수 / 등급" value={item.score} maxLength={50} onChange={(value) => patch('languages', draft.languages.map((row) => row.id === item.id ? { ...row, score: value } : row))} />
                        </div>
                      </RepeatCard>
                    ))}
                  </div>
                </FormSection>

                <FormSection title="포트폴리오와 링크" actionLabel="링크 추가" onAdd={draft.links.length < 10 ? () => patch('links', [...draft.links, newLink()]) : undefined}>
                  <div className="space-y-4">
                    {draft.links.length === 0 && <EmptyRows label="등록된 링크가 없습니다." />}
                    {draft.links.map((item, index) => (
                      <RepeatCard key={item.id} title={`링크 ${index + 1}`} onRemove={() => patch('links', draft.links.filter((row) => row.id !== item.id))}>
                        <div className="grid gap-3 sm:grid-cols-2"><TextField label="링크 이름" value={item.label} maxLength={60} onChange={(value) => patch('links', draft.links.map((row) => row.id === item.id ? { ...row, label: value } : row))} placeholder="포트폴리오" /><TextField label="URL" type="url" value={item.url} maxLength={500} onChange={(value) => patch('links', draft.links.map((row) => row.id === item.id ? { ...row, url: value } : row))} placeholder="https://" /></div>
                      </RepeatCard>
                    ))}
                  </div>
                </FormSection>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white p-4">
                  <button type="button" onClick={deleteResume} disabled={busy} className="text-sm font-semibold text-state-urgent disabled:opacity-50">{deleting ? '삭제 중…' : '이력서 삭제'}</button>
                  <div className="flex gap-2">{nextHref && !dirty && submissionReady && <Link href={nextHref} className="btn-outline">지원 화면으로 돌아가기</Link>}<button type="button" onClick={saveResume} disabled={busy} className="btn-primary disabled:opacity-50">{saving ? '저장 중…' : '저장하기'}</button></div>
                </div>
              </fieldset>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function FormSection({ title, description, actionLabel, onAdd, children }: { title: string; description?: string; actionLabel?: string; onAdd?: () => void; children: React.ReactNode }) {
  return <section className="rounded border border-gray-200 bg-white p-5 sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-gray-900">{title}</h2>{description && <p className="mt-1 text-sm text-gray-500">{description}</p>}</div>{actionLabel && onAdd && <button type="button" onClick={onAdd} className="shrink-0 text-sm font-bold text-primary hover:underline">+ {actionLabel}</button>}</div>{children}</section>;
}

function TextField({ label, value, onChange, type = 'text', placeholder, maxLength, required, disabled }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; maxLength?: number; required?: boolean; disabled?: boolean }) {
  return <label className="block text-sm font-semibold text-gray-700">{label}{required && <span className="text-state-urgent"> *</span>}<input type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} disabled={disabled} className="input-field mt-1 disabled:bg-gray-100" /></label>;
}

// 셀렉트 — 네이티브 화살표 대신 커스텀 chevron 으로 통일
function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">{label}
      <div className="relative mt-1">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field w-full appearance-none pr-9">{children}</select>
        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </div>
    </label>
  );
}

// 날짜/월 필드 — 네이티브 대신 커스텀 SmartDate 사용
function DateField({ label, value, onChange, granularity = 'month', disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; granularity?: 'month' | 'day'; disabled?: boolean; placeholder?: string }) {
  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <SmartDate value={value} onChange={onChange} granularity={granularity} disabled={disabled} noFuture placeholder={placeholder ?? (granularity === 'month' ? '년/월 선택' : '날짜 선택')} />
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder, maxItems, maxLength }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; maxItems: number; maxLength: number }) {
  const [input, setInput] = useState('');
  function add() { const value = input.trim().replace(/,$/, ''); if (value && value.length <= maxLength && values.length < maxItems && !values.includes(value)) onChange([...values, value]); setInput(''); }
  return <div><label className="block text-sm font-semibold text-gray-700">{label}<input value={input} maxLength={maxLength} disabled={values.length >= maxItems} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} onBlur={add} className="input-field mt-1 disabled:bg-gray-100" placeholder={values.length >= maxItems ? `최대 ${maxItems}개` : placeholder} /></label><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <button key={value} type="button" onClick={() => onChange(values.filter((item) => item !== value))} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-state-urgent hover:text-state-urgent">{value} ×</button>)}</div></div>;
}

function RepeatCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return <div className="rounded border border-gray-200 bg-gray-50/60 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-gray-800">{title}</p><button type="button" onClick={onRemove} className="text-xs font-semibold text-gray-400 hover:text-state-urgent">삭제</button></div>{children}</div>;
}

function EmptyRows({ label }: { label: string }) {
  return <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-400">{label}</div>;
}

// 완성도 가이드 — 무엇을 채우면 제출 가능한지 항목별로 안내
function CompletenessChecklist({ resume, score, submittable }: { resume: ResumeContent; score: number; submittable: boolean }) {
  const items = completenessItems(resume);
  const remaining = items.filter((i) => !i.done).length;
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-gray-900">{score}<span className="text-base font-bold text-gray-400">%</span></span>
            {submittable
              ? <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>제출 가능</span>
              : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600">제출까지 {Math.max(0, 60 - score)}%</span>}
          </div>
          <p className="mt-1 text-xs text-gray-500">{submittable ? '지원할 때 이 이력서를 바로 제출할 수 있어요.' : `아래 ${remaining}개 항목 중 필요한 만큼 채우면 제출할 수 있어요.`}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${score}%` }} />
      </div>
      <ul className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-primary text-white' : 'border border-gray-300'}`}>
              {item.done && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
            </span>
            <span className={item.done ? 'text-gray-400 line-through' : 'font-medium text-gray-700'}>{item.label}</span>
            {item.required && !item.done && <span className="rounded bg-state-urgent-bg px-1 text-[10px] font-bold text-state-urgent">필수</span>}
            <span className="ml-auto text-[11px] tabular-nums text-gray-300">+{item.points}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
