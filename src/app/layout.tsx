import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'סוכן ארנונה | עיריית ירושלים',
  description: 'מערכת לזיהוי עסקים החשודים בתשלום ארנונת מגורים',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
