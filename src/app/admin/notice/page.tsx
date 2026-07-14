'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/components/Toast';
import RichTextEditor from '@/shared/components/RichTextEditor';
import { usePendingUploads } from '@/shared/hooks/usePendingUploads';
import { apiFetch } from '@/shared/utils/apiFetch';

interface NoticeRow {
  id: string;
  title: string;
  created_at: string;
}

// 리치 에디터 HTML 에 실질 내용(텍스트/이미지)이 있는지
function hasContent(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length > 0 || /<img/i.test(html);
}

export default function AdminNoticePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const contentRef = useRef(content);
  // 현재 초안의 생성 ID는 timeout/재시도 사이에 유지하고, 성공 후에만 교체한다.
  const createIdRef = useRef<string | null>(null);
  const { trackUpload, waitForUploads, pendingCount } = usePendingUploads();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/notice', { credentials: 'include' }, 12000);
      const body = await res.json().catch(() => ({}));
      if (res.ok) setNotices(body.notices ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (savingRef.current) return;
    if (!title.trim()) {
      toast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await waitForUploads();
      const latestContent = contentRef.current;
      if (!hasContent(latestContent)) {
        toast('제목과 내용을 입력해주세요.', 'error');
        return;
      }
      const createId = createIdRef.current ?? crypto.randomUUID();
      createIdRef.current = createId;
      const res = await apiFetch('/api/admin/notice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: createId, title: title.trim(), content: latestContent }),
      }, 12000);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '등록에 실패했습니다.');
      if (body.notice) setNotices((prev) => [body.notice, ...prev.filter((notice) => notice.id !== body.notice.id)]);
      toast('공지글을 등록했습니다.', 'success');
      createIdRef.current = null;
      setTitle('');
      contentRef.current = '';
      setContent('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록에 실패했습니다.', 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 공지글을 삭제할까요?')) return;
    try {
      const res = await apiFetch('/api/admin/notice', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 12000);
      if (!res.ok) throw new Error();
      toast('삭제했습니다.', 'success');
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast('삭제에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">공지글 등록</h1>
        <p className="mt-1 text-sm text-gray-500">등록한 공지글은 커뮤니티·메인페이지 상단에 &lsquo;공지&rsquo; 배지와 함께 노출됩니다.</p>
      </div>

      <fieldset disabled={saving} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="n-title" className="block text-sm font-semibold text-gray-800">제목</label>
          <input
            id="n-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            placeholder="공지 제목"
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-800">내용</label>
          <RichTextEditor
            value={content}
            onChange={(html) => {
              contentRef.current = html;
              setContent(html);
            }}
            placeholder="공지 내용을 입력하세요. 이미지·굵기·제목 등 서식을 사용할 수 있어요."
            minHeight={240}
            imageUploadEndpoint="/api/admin/upload-image?target=notice"
            onUploadPromise={trackUpload}
            disabled={saving}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? (pendingCount > 0 ? `본문 사진 ${pendingCount}건 마무리 중...` : '등록 중...') : '공지 등록'}
          </button>
        </div>
      </fieldset>

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-gray-800">등록된 공지 ({notices.length})</h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : notices.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">등록된 공지글이 없습니다.</p>
          ) : (
            notices.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={ROUTES.COMMUNITY_DETAIL(n.id)}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 hover:text-primary"
                >
                  {n.title}
                </Link>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                  {new Date(n.created_at).toLocaleDateString('ko-KR')}
                </span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="shrink-0 rounded border border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
