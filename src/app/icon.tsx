import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="7" fill="#FFFFFF" />
        <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="#E5E7EB" strokeWidth="1" />
        <path
          d="M8 22.4V10.2L16 18l8-7.8v12.2"
          stroke="#051049"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 18v4.4"
          stroke="#F2C879"
          strokeWidth="2.7"
          strokeLinecap="round"
        />
        <circle cx="23.2" cy="7.8" r="1.7" fill="#F2C879" />
      </svg>
    ),
    { ...size }
  );
}
