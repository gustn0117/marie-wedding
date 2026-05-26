'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewService, reviewErrorMessage } from '@/features/reviews/services/reviewService';
import type { ReviewTag } from '@/types/database';

interface Props {
  applicationId: string;
  appliesTo: 'hiring' | 'applicant'; // 리뷰 대상의 역할 (= 어떤 태그를 보여줄지)
}

export default function ReviewForm({ applicationId, appliesTo }: Props) {
  const router = useRouter();
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewService.listActiveTags()
      .then((data) => setTags(data.filter((t) => t.applies_to.includes(appliesTo))))
      .catch(() => setError('태그를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [appliesTo]);

  const grouped = useMemo(() => {
    const positive = tags.filter((t) => t.category === 'positive');
    const attention = tags.filter((t) => t.category === 'attention');
    return { positive, attention };
  }, [tags]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) { setError('태그를 1개 이상 선택해 주세요.'); return; }
    setBusy(true); setError(null);
    try {
      await reviewService.submit(applicationId, Array.from(selected));
      router.push('/mypage');
      router.refresh();
    } catch (err) {
      setError(reviewErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">태그를 불러오는 중…</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-3">
          거래 상대에 대한 태그를 <strong>최대 5개</strong>까지 선택해 주세요. 자유 텍스트는 입력하지 않습니다.
          작성 후 수정할 수 없으니 신중하게 선택해 주세요.
        </p>
        <p className="text-xs text-gray-500">선택: {selected.size}/5</p>
      </div>

      <section>
        <h2 className="text-sm font-bold text-gray-900 mb-2">긍정 태그</h2>
        <div className="flex flex-wrap gap-2">
          {grouped.positive.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              active={selected.has(t.id)}
              disabled={!selected.has(t.id) && selected.size >= 5}
              onClick={() => toggle(t.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-gray-900 mb-2">주의 태그</h2>
        <div className="flex flex-wrap gap-2">
          {grouped.attention.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              active={selected.has(t.id)}
              disabled={!selected.has(t.id) && selected.size >= 5}
              onClick={() => toggle(t.id)}
            />
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-state-urgent">{error}</p>}

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={busy || selected.size === 0}
          className="btn-primary min-h-[44px] px-6 disabled:opacity-50"
        >
          {busy ? '제출 중…' : '리뷰 제출'}
        </button>
      </div>
    </form>
  );
}

function TagChip({
  tag,
  active,
  disabled,
  onClick,
}: {
  tag: ReviewTag;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const baseClass = 'inline-flex items-center px-3 py-1.5 text-xs font-bold border transition-colors disabled:cursor-not-allowed';
  const activeClass = active
    ? tag.category === 'positive'
      ? 'bg-primary text-white border-black'
      : 'bg-gray-700 text-white border-gray-700'
    : 'bg-white text-gray-700 border-gray-300 hover:border-primary disabled:opacity-40';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !active}
      className={`${baseClass} ${activeClass}`}
    >
      {tag.label}
    </button>
  );
}
