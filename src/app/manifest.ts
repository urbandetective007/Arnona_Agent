import type { MetadataRoute } from 'next'

// Makes the site installable as an app ("הוסף למסך הבית"). Paths carry the
// GitHub Pages base path by hand — the manifest's URLs aren't rewritten.
const BASE = '/Arnona_Agent'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: 'ארנו-נט · עיריית ירושלים',
    short_name: 'ארנו-נט',
    description: 'מערכת לזיהוי עסקים עם אינדיקציה לתשלום ארנונת מגורים',
    lang: 'he',
    dir: 'rtl',
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d1b2e',
    theme_color: '#0d1b2e',
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
