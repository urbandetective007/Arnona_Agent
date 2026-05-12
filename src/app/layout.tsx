import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'סוכן ארנונה | עיריית ירושלים',
  description: 'מערכת לזיהוי עסקים החשודים בתשלום ארנונת מגורים',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
