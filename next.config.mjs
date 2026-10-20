/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // 메타데이터(title·description·canonical·og)를 모든 요청에서 <head> 에 넣는다.
  // Next 15.2+ 는 동적 페이지 메타데이터를 일반 UA 에는 본문 끝으로 '스트리밍'하는데, 다음(Daumoa)·
  // 카카오톡 미리보기(kakaotalk-scrap)처럼 JS 를 안 돌리고 <head> 만 읽는 수집기가 제목·미리보기를 놓친다.
  // 이 설정은 메타데이터 위치만 바꾼다(본문 스트리밍·loading.tsx 는 그대로).
  htmlLimitedBots: /.*/,
  images: {
    // 기본 이미지와 고해상도 메인 광고에 사용하는 품질 값을 명시한다.
    qualities: [75, 95],
  },
  experimental: {
    // Client Router Cache: dynamic 페이지의 기본 30s stale-time 을 0 으로 낮춰
    // 저장 직후 다른 페이지로 이동해도 옛 스냅샷이 아닌 최신 서버 렌더가 뜨도록.
    // (Next 14.2+ 지원)
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
