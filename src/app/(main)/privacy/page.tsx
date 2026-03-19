export const metadata = {
  title: '개인정보처리방침 | 마리에',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto prose prose-sm">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>
      <div className="card p-6 md:p-8 space-y-6 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">1. 수집하는 개인정보 항목</h2>
          <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>필수: 이메일, 이름, 업종, 지역</li>
            <li>선택: 업체명, 연락처, 웹사이트, 소개</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 관리: 회원제 서비스 이용, 개인 식별, 불량 회원의 부정 이용 방지</li>
            <li>서비스 제공: 채용 공고, 업체 디렉토리, 커뮤니티 서비스 제공</li>
            <li>서비스 개선: 서비스 이용 통계, 맞춤 서비스 제공</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">3. 개인정보의 보유 및 이용 기간</h2>
          <p>회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다. 단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">4. 개인정보의 제3자 제공</h2>
          <p>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 이용자의 동의가 있거나 법령의 규정에 의한 경우는 예외로 합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">5. 개인정보 보호책임자</h2>
          <p>개인정보 처리에 관한 업무를 총괄하는 개인정보 보호책임자는 다음과 같습니다.</p>
          <p className="mt-2">이메일: privacy@marie.co.kr</p>
        </section>
      </div>
    </div>
  );
}
