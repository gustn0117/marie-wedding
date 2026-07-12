/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
