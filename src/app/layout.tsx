import type { Metadata } from 'next'
import { Assistant, Heebo } from 'next/font/google'
import { IosActiveFix } from '@/components/IosActiveFix'
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${heebo.variable}`}>
      <body>
        <IosActiveFix />
        {children}
      </body>
    </html>
  )
}
