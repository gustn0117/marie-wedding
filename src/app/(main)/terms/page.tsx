import type { Metadata } from 'next';
import { buildPageMetadata } from '@/shared/seo';

export const metadata: Metadata = buildPageMetadata({
  title: '이용약관',
  description: '마리에(Marié) 서비스 이용약관 — 회원 가입, 채용 공고 등록과 지원, 프로필·커뮤니티 이용, 금지 행위와 신고·차단에 관한 권리와 의무를 안내합니다.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto prose prose-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이용약관</h1>
      <div className="card p-6 md:p-8 space-y-6 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제1조 (목적)</h2>
          <p>이 약관은 Marié(이하 &quot;회사&quot;)가 제공하는 웨딩 업계 구인구직 플랫폼 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제2조 (용어의 정의)</h2>
          <p>&quot;서비스&quot;란 회사가 제공하는 웨딩 업계 채용, 인재·업체 프로필, 커뮤니티 등 모든 서비스를 의미합니다.</p>
          <p>&quot;회원&quot;이란 서비스에 가입하여 이용 자격을 부여받은 자를 말합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제3조 (약관의 효력 및 변경)</h2>
          <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 공지 후 효력이 발생합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제4조 (서비스의 제공)</h2>
          <p>회사는 다음과 같은 서비스를 제공합니다:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>웨딩 업계 채용 공고 등록 및 검색</li>
            <li>인재·업체 프로필 관리</li>
            <li>커뮤니티 게시판</li>
            <li>기타 회사가 정하는 서비스</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제5조 (금지 행위와 게시물 기준)</h2>
          <p>회원은 서비스에 다음과 같은 내용을 올리거나 다른 회원에게 보내서는 안 됩니다. 회사는 이러한 게시물과 이를 올린 회원에 대해 무관용 원칙을 적용합니다.</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>욕설, 비방, 모욕, 혐오·차별 표현, 괴롭힘이나 위협</li>
            <li>음란하거나 폭력적인 내용, 불법 촬영물 등 법령에 어긋나는 내용</li>
            <li>허위 채용 공고, 사기, 금전 요구 등 다른 회원을 속이는 내용</li>
            <li>다른 사람의 개인정보를 동의 없이 올리는 일, 다른 사람을 사칭하는 일</li>
            <li>스팸, 광고, 같은 내용을 되풀이해 올리는 일</li>
            <li>그 밖에 다른 회원의 권리를 해치거나 서비스 운영을 방해하는 내용</li>
          </ul>
          <p className="mt-2">회사는 부적절한 표현을 자동으로 걸러 내며, 이 기준에 어긋나는 게시물은 사전 통지 없이 숨기거나 삭제할 수 있습니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제6조 (신고, 차단과 조치)</h2>
          <p>회원은 공고, 게시글, 댓글, 프로필, 쪽지를 신고할 수 있고, 다른 회원을 차단할 수 있습니다. 차단한 회원의 글과 댓글은 보이지 않으며 서로 쪽지를 주고받을 수 없습니다. 차단은 마이페이지 &gt; 차단한 사용자에서 언제든 해제할 수 있습니다.</p>
          <p className="mt-2">회사는 신고를 접수하면 24시간 안에 검토하여, 기준에 어긋나는 게시물을 삭제하고 이를 올린 회원의 이용을 제한하거나 계정을 삭제합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제7조 (회원 탈퇴)</h2>
          <p>회원은 마이페이지 &gt; 회원 탈퇴에서 언제든지 탈퇴할 수 있습니다. 탈퇴하면 계정과 작성한 공고, 게시글은 비공개 처리되며, 개인정보는 개인정보처리방침에 따라 처리합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제8조 (문의)</h2>
          <p>서비스 이용, 신고 처리, 계정에 관한 문의는 고객센터(<a href="/contact" className="text-primary underline">marie.co.kr/contact</a>) 또는 이메일(<a href="mailto:admin@marie.co.kr" className="text-primary underline">admin@marie.co.kr</a>)로 해 주세요.</p>
        </section>
        <p className="pt-2 text-xs text-text-muted">시행일: 2026년 11월 10일</p>
      </div>
    </div>
  );
}
