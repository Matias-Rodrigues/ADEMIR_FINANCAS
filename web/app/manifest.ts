import type { MetadataRoute } from 'next'
import { BRAND_COLOR } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ademir Finanças',
    short_name: 'Ademir Finanças',
    description: 'CRM de gestão da propriedade rural',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: BRAND_COLOR,
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  }
}
