import ModerationKeywordsManager from '@/features/admin/components/ModerationKeywordsManager';
import PageHeader from '@/shared/components/PageHeader';

export const dynamic = 'force-dynamic';

export default function AdminModerationKeywordsPage() {
  return (
    <main className="space-y-4">
      <PageHeader
        eyebrow="관리자"
        title="자동 모더레이션 키워드"
        description="여기에 등록된 키워드를 공고/글/댓글 본문에서 발견하면 작성 시점에 자동으로 숨겨집니다. 신중하게 등록해 주세요. 부분 문자열 매칭이라 짧은 단어는 오탐 위험이 있습니다."
      />
      <ModerationKeywordsManager />
    </main>
  );
}
