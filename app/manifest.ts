import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AroStats',
    short_name: 'AroStats',
    description: 'Planilla de estadísticas de basketball',
    start_url: '/login',
    display: 'standalone',
    background_color: '#060C1A',
    theme_color: '#060C1A',
    orientation: 'landscape',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
