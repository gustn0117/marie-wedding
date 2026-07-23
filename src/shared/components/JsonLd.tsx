// 구조화 데이터(JSON-LD) 스크립트 렌더러.
// `<` 를 유니코드 이스케이프해 사용자 작성 콘텐츠(공고 제목/본문 등)로 </script> 를
// 닫고 빠져나가는 XSS 를 차단한다.
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
