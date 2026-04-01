import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/svg+xml'

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="32"
        height="32"
      >
        <rect width="32" height="32" fill="#10b981" rx="6" />
        <path
          d="M16 6L6 12V22L16 28L26 22V12L16 6ZM16 10L22 13.5V19L16 22.5L10 19V13.5L16 10Z"
          fill="white"
        />
      </svg>
    ),
    {
      ...size,
    }
  )
}
