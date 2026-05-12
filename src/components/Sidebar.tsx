'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/',           label: 'דשבורד'         },
  { href: '/businesses', label: 'כלל הנתונים'     },
  { href: '/files',      label: 'קבצים שהועלו'   },
  { href: '/upload',     label: 'העלאת דוח חדש'  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router  = useRouter()

  return (
    <aside
      style={{ borderColor: 'var(--color-hairline)' }}
      className="w-52 flex-shrink-0 bg-white border-l flex flex-col min-h-screen sticky top-0"
    >
      {/* Logo */}
      <div style={{ borderColor: 'var(--color-hairline)' }} className="px-6 py-6 border-b">
        <p style={{ color: 'var(--color-ink)', fontWeight: 500, fontSize: 15 }}>סוכן ארנונה</p>
        <p style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 2 }}>עיריית ירושלים</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={active
                ? { background: 'var(--color-ink)', color: '#fff', borderRadius: 10, fontWeight: 500 }
                : { color: 'var(--color-body)', borderRadius: 10 }
              }
              className="block px-4 py-2.5 text-sm transition-colors hover:bg-[#f8fafc]"
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ borderColor: 'var(--color-hairline)' }} className="px-3 py-4 border-t">
        <button
          onClick={() => { logout(); router.push('/login') }}
          style={{ color: 'var(--color-muted)', borderRadius: 10 }}
          className="w-full text-right px-4 py-2.5 text-sm hover:bg-[#f8fafc] transition-colors"
        >
          יציאה
        </button>
      </div>
    </aside>
  )
}
