export const metadata = {
  title: '이용약관 | 마리에',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto prose prose-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">이용약관</h1>
      <div className="card p-6 md:p-8 space-y-6 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제1조 (목적)</h2>
          <p>이 약관은 Marié(이하 &quot;회사&quot;)가 제공하는 웨딩 업계 B2B 네트워크 플랫폼 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항 등을 규정함을 목적으로 합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">제2조 (용어의 정의)</h2>
          <p>&quot;서비스&quot;란 회사가 제공하는 웨딩 업계 채용, 업체 디렉토리, 커뮤니티 등 모든 서비스를 의미합니다.</p>
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
            <li>업체 디렉토리 및 프로필 관리</li>
            <li>커뮤니티 게시판</li>
            <li>기타 회사가 정하는 서비스</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
