import { ImageResponse } from 'next/og'

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
          background: '#16a34a',
          color: 'white',
          fontSize: 260,
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    { width: 512, height: 512 }
  )
}
