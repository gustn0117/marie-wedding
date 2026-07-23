import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// 홈 화면 추가용 아이콘 — 투명 배경 대신 흰 배경 + 네이비 'M' 마크.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 22.4V10.2L16 18l8-7.8v12.2"
            stroke="#051049"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M16 18v4.4" stroke="#F2C879" strokeWidth="2.7" strokeLinecap="round" />
          <circle cx="23.2" cy="7.8" r="1.7" fill="#F2C879" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
