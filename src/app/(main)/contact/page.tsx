export const metadata = {
  title: '고객센터 | 마리에',
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">고객센터</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">이메일 문의</h3>
          <p className="text-sm text-text-secondary">support@marie.co.kr</p>
          <p className="text-xs text-text-muted mt-1">영업일 기준 24시간 이내 답변</p>
        </div>

        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">전화 문의</h3>
          <p className="text-sm text-text-secondary">02-0000-0000</p>
          <p className="text-xs text-text-muted mt-1">평일 09:00 ~ 18:00</p>
        </div>
      </div>

      <div className="card p-6 md:p-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">자주 묻는 질문</h2>
        <div className="space-y-4">
          {[
            { q: '회원가입은 어떻게 하나요?', a: '홈페이지 우측 상단의 "회원가입" 버튼을 클릭하여 이메일과 기본 정보를 입력하시면 됩니다.' },
            { q: '공고 등록은 무료인가요?', a: '현재 모든 공고 등록은 무료로 제공되고 있습니다.' },
            { q: '프로필 정보를 수정하고 싶어요.', a: '로그인 후 우측 상단 프로필 메뉴에서 "마이페이지"를 클릭하신 후 "프로필 수정"에서 변경하실 수 있습니다.' },
            { q: '비밀번호를 잊어버렸어요.', a: '로그인 페이지에서 "비밀번호 찾기"를 통해 가입하신 이메일로 재설정 링크를 받으실 수 있습니다.' },
            { q: '광고/제휴 문의는 어떻게 하나요?', a: 'support@marie.co.kr로 문의 내용을 보내주시면 담당자가 확인 후 연락드리겠습니다.' },
          ].map((faq, idx) => (
            <details key={idx} className="group">
              <summary className="flex items-center justify-between cursor-pointer py-3 border-b border-gray-100 text-sm font-medium text-text-primary hover:text-primary transition-colors">
                {faq.q}
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <p className="text-sm text-text-secondary py-3 pl-1">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
