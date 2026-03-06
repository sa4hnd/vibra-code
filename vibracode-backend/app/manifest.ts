import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VibraCode - AI Mobile App Builder',
    short_name: 'VibraCode',
    description: 'Build stunning mobile apps with AI in minutes. Create iOS and Android apps instantly with our intelligent mobile development platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
      {
        src: '/brand-assets/vibra-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand-assets/vibra-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    categories: ['productivity', 'developer', 'utilities'],
    lang: 'en',
    scope: '/',
  }
}
