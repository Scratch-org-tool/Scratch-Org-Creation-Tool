import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

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
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          borderRadius: 36,
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.9-1A4 4 0 1 1 17 18H7Z"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
