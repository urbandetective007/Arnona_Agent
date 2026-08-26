'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/',           label: 'דשבורד'        },
  { href: '/businesses', label: 'כלל הנתונים'    },
  { href: '/map',        label: 'מפת נכסים'     },
  { href: '/files',      label: 'קבצים שהועלו'  },
  { href: '/upload',     label: 'העלאת דוח חדש' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  return (
    <aside style={{ width: 208, flexShrink: 0, background: 'var(--ink)', display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'sticky', top: 0 }}>

      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ color: 'var(--on-ink)', fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>סוכן ארנונה</p>
        <p style={{ color: 'var(--graphite)', fontSize: 12, marginTop: 3 }}>עיריית ירושלים</p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'block',
              padding: '10px 12px',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--on-ink)' : 'var(--steel)',
              background: active ? 'var(--hp-blue)' : 'transparent',
              textDecoration: 'none',
            }}>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 8px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={async () => { await logout(); router.push('/login') }} style={{
          width: '100%', textAlign: 'right', padding: '10px 12px',
          background: 'none', border: 'none', borderRadius: 4,
          color: 'var(--graphite)', fontSize: 14, cursor: 'pointer',
        }}>
          יציאה
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 4, letterSpacing: '0.5px' }}>
          v1.4 · Supabase
        </p>
      </div>
    </aside>
  )
}
