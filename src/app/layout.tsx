import type { Metadata, Viewport } from 'next'
import { Assistant, Heebo } from 'next/font/google'
import { IosActiveFix } from '@/components/IosActiveFix'
import { PwaSetup } from '@/components/PwaSetup'
import { Toaster } from '@/components/ui/Toast'
import './globals.css'

// Assistant (UI text) + Heebo (tabular digits, via the `.num` helper class) —
// both have real Hebrew glyphs, unlike Manrope which silently fell back to
// Arial for every Hebrew character on the old site.
const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-assistant',
})

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'ארנו-נט | עיריית ירושלים',
  description: 'מערכת לזיהוי עסקים עם אינדיקציה לתשלום ארנונת מגורים',
  applicationName: 'ארנו-נט',
  // Installed on iPhone: full-screen, light status-bar text over the navy header.
  appleWebApp: { capable: true, title: 'ארנו-נט', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/Arnona_Agent/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/Arnona_Agent/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1b2e',
  width: 'device-width',
  initialScale: 1,
  // Lets the layout reach under the notch / home bar (safe-area padding handles the rest).
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${heebo.variable}`}>
      <body>
        <IosActiveFix />
        {children}
        <PwaSetup />
        <Toaster />
      </body>
    </html>
  )
}
