import SupportInquiryForm from '@/features/support/components/SupportInquiryForm';

export const metadata = {
  title: '마리에 고객센터 | 마리에',
};

/**
 * 연락처는 env 로 관리 — 변경 시 코드 수정 없이 배포.
 */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'help@marie.co.kr';
const CONTACT_HOURS = process.env.NEXT_PUBLIC_CONTACT_HOURS || '평일 10:00 ~ 18:00';

export default function ContactPage() {
  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <section className="saramin-section p-5">
        <p className="text-sm font-bold text-primary">고객센터 안내</p>
        <h1 className="text-2xl font-bold text-gray-900">마리에 고객센터</h1>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">이메일 문의</h3>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-text-secondary hover:text-primary break-all">{CONTACT_EMAIL}</a>
          <p className="text-xs text-text-muted mt-1">영업일 기준 24시간 이내</p>
        </div>

        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-50 rounded flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">운영 시간</h3>
          <p className="text-sm text-text-secondary">{CONTACT_HOURS}</p>
          <p className="text-xs text-text-muted mt-1">주말·공휴일 휴무</p>
        </div>
      </div>

      {/* 문의 폼 */}
      <SupportInquiryForm />

      <div className="card p-6 md:p-8">
        <h2 className="text-lg font-bold text-text-primary mb-4">자주 묻는 질문</h2>
        <div className="space-y-4">
          {[
            { q: '회원가입은 어떻게 하나요?', a: '홈페이지 우측 상단의 "회원가입" 버튼을 클릭하여 이메일과 기본 정보를 입력하시면 됩니다.' },
            { q: '공고 등록은 무료인가요?', a: '현재 모든 공고 등록은 무료로 제공되고 있습니다.' },
            { q: '프로필 정보를 수정하고 싶어요.', a: '로그인 후 우측 상단 프로필 메뉴에서 "마이페이지"를 클릭하신 후 "프로필 수정"에서 변경하실 수 있습니다.' },
            { q: '비밀번호를 잊어버렸어요.', a: '로그인 페이지에서 "비밀번호 찾기"를 통해 가입하신 이메일로 재설정 링크를 받으실 수 있습니다.' },
            { q: '광고/제휴 문의는 어떻게 하나요?', a: `${CONTACT_EMAIL}으로 문의 내용을 보내주시거나 위 문의하기를 이용해주시면 담당자가 확인 후 연락드리겠습니다.` },
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
