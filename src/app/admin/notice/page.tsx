'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/constants';
import { toast } from '@/shared/components/Toast';

interface NoticeRow {
  id: string;
  title: string;
  created_at: string;
}

// 줄바꿈 있는 평문 → 간단한 HTML 문단 (RichTextView 호환)
function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}

export default function AdminNoticePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notice', { credentials: 'include' });
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
    if (!title.trim() || !content.trim()) {
      toast('제목과 내용을 입력해주세요.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/notice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: textToHtml(content.trim()) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '등록에 실패했습니다.');
      toast('공지글을 등록했습니다.', 'success');
      setTitle('');
      setContent('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 공지글을 삭제할까요?')) return;
    try {
      const res = await fetch('/api/admin/notice', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
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

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
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
          <label htmlFor="n-content" className="block text-sm font-semibold text-gray-800">내용</label>
          <textarea
            id="n-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="w-full rounded border border-gray-300 px-4 py-3 text-sm resize-y focus:outline-none focus:border-primary"
            placeholder="공지 내용을 입력하세요. 줄바꿈은 그대로 유지됩니다."
            maxLength={10000}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded bg-primary px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? '등록 중...' : '공지 등록'}
          </button>
        </div>
      </div>

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
