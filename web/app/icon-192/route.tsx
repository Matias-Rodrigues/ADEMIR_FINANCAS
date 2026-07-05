import { ImageResponse } from 'next/og'
import { BRAND_COLOR } from '@/lib/brand'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_COLOR,
          color: 'white',
          fontSize: 100,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    { width: 192, height: 192 }
  )
}
