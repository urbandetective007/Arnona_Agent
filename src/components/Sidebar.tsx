'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/',            label: 'דשבורד',          icon: '📊' },
  { href: '/businesses',  label: 'כלל הנתונים',      icon: '🏢' },
  { href: '/files',       label: 'קבצים שהועלו',     icon: '📁' },
  { href: '/upload',      label: 'העלאת דוח חדש',   icon: '⬆️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <aside className="w-52 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col min-h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="font-bold text-gray-900 text-sm">סוכן ארנונה</p>
        <p className="text-xs text-gray-400 mt-0.5">עיריית ירושלים</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_LINKS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              pathname === href
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <span>🚪</span>
          יציאה
        </button>
      </div>
    </aside>
  )
}
