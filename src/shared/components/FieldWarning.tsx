// 폼 필드 아래 인라인 경고 메시지 (필수항목 누락/형식오류 시). 해당 필드로 스크롤 이동과 함께 사용.
export function FieldWarning({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-state-urgent">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {message}
    </p>
  );
}

// 누락된 필드 컨테이너 강조용 클래스. `scroll-mt-24` 는 스크롤 시 상단 헤더에 안 가리게.
// 패딩을 바꾸지 않는 '링'만 추가하므로 카드형 필드(자체 패딩)에도 안전하게 얹힌다.
export function fieldWrapClass(active: boolean): string {
  return `scroll-mt-24 ${active ? 'ring-2 ring-state-urgent/60 ring-offset-2' : ''}`;
}
