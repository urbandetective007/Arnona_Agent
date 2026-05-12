import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'סוכן ארנונה | עיריית ירושלים',
  description: 'מערכת לזיהוי עסקים החשודים בתשלום ארנונת מגורים',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={manrope.variable}>
      <body>{children}</body>
    </html>
  )
}
