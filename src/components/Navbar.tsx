'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/',       label: 'דשבורד' },
  { href: '/files',  label: 'קבצים שהועלו' },
  { href: '/upload', label: '+ העלאת דוח' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <button
        onClick={handleLogout}
        className="text-sm text-gray-400 hover:text-red-500 transition-colors"
      >
        יציאה
      </button>
      <div className="flex gap-1">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="text-right">
        <span className="font-bold text-gray-800 text-sm">סוכן ארנונה</span>
        <p className="text-xs text-gray-400">עיריית ירושלים</p>
      </div>
    </nav>
  )
}
