'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Landmark, ShieldCheck, LogOut, Menu, X } from 'lucide-react'
import { logout } from '@/lib/auth'
import { RoleProvider, useRoleContext } from './RoleContext'
import { NAV_BY_ROLE, ROLE_DESCRIPTION_BY_ROLE, type NavItem } from '@/lib/access'
import { ROLES } from '@/lib/roles'
import { PageHeader } from './ui'

interface AppShellProps {
  children: ReactNode
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Trims the page's side margins, for pages built around a wide table. */
  wide?: boolean
}

// Replaces AppLayout + Sidebar: a dark 240px sidebar grouped by section
// (per NAV_BY_ROLE's `group` field) with a role badge and user block, plus
// a top bar that every page feeds via `title`/`subtitle`/`actions` instead
// of building its own header markup. Still fully driven by the existing
// role system (`useRoleContext`, `NAV_BY_ROLE`) — nothing about auth or
// routing changes here.
export function AppShell(props: AppShellProps) {
  return (
    <RoleProvider>
      <AppShellInner {...props} />
    </RoleProvider>
  )
}

function AppShellInner({ children, title, subtitle, actions, wide }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const role = useRoleContext()

  const navItems = role ? NAV_BY_ROLE[role] : []
  const groups: { name: string; items: NavItem[] }[] = []
  for (const item of navItems) {
    const group = groups.find(g => g.name === item.group)
    if (group) group.items.push(item)
    else groups.push({ name: item.group, items: [item] })
  }

  const roleOption = ROLES.find(r => r.id === role)

  // Phone/tablet menu drawer. Escape closes it; the page behind doesn't scroll.
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-chrome-hairline">
        <Landmark size={24} strokeWidth={1.7} className="text-brand-light shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-white font-bold text-[15px] truncate">ארנו-נט</div>
          <div className="text-chrome-graphite text-[11.5px] mt-0.5">עיריית ירושלים</div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="סגירת התפריט"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-chrome-graphite hover:text-chrome-ink hover:bg-white/5 active:scale-90 transition-[background-color,color,transform] cursor-pointer"
        >
          <X size={19} strokeWidth={1.9} />
        </button>
      </div>

      {roleOption && (
        <div className="mx-3 mt-3.5 mb-1 px-3 py-2.5 rounded-[10px] bg-brand/10 border border-brand/25 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
            <ShieldCheck size={15} className="text-white" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-chrome-ink text-[12.5px] font-semibold truncate">{roleOption.label}</div>
            <div className="text-chrome-graphite text-[11px] truncate">{ROLE_DESCRIPTION_BY_ROLE[roleOption.id]}</div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2.5 py-1.5 flex flex-col gap-0.5">
        {groups.map(group => (
          <div key={group.name}>
            <div className="text-chrome-subtle text-[10.5px] font-semibold px-2.5 pt-3 pb-1.5">{group.name}</div>
            {group.items.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-3 lg:py-2.5 rounded-lg text-[14px] lg:text-[13.5px] transition-colors ${
                    active ? 'bg-brand text-white font-semibold' : 'text-chrome-graphite hover:bg-white/5 hover:text-chrome-ink'
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-chrome-hairline flex items-center gap-2.5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex-1 min-w-0">
          <div className="text-chrome-ink text-[12.5px] font-semibold truncate">{roleOption?.label ?? '—'}</div>
          <div className="text-chrome-subtle text-[11px]">
            מחובר/ת · <span className="num" title={`עודכן ${process.env.APP_BUILD_DATE}`}>גרסה {process.env.APP_VERSION}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => { await logout(); router.push('/login') }}
          aria-label="יציאה"
          title="יציאה"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-chrome-graphite hover:text-chrome-ink hover:bg-white/10 active:scale-90 transition-[background-color,color,transform] shrink-0 cursor-pointer"
        >
          <LogOut size={17} strokeWidth={1.8} />
        </button>
      </div>
    </>
  )

  const chromeBg = { background: 'linear-gradient(180deg, var(--color-chrome) 0%, var(--color-chrome-deep) 100%)' }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop: a fixed sidebar. It's the first DOM child, so under
          dir="rtl" it lands on the visual right — no `order` needed. */}
      <aside className="hidden lg:flex w-60 shrink-0 sticky top-0 h-screen flex-col" style={chromeBg}>
        {sidebar}
      </aside>

      {/* Phone/tablet: the same sidebar as a slide-in drawer from the right. */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/45 transition-opacity duration-200 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`lg:hidden fixed top-0 bottom-0 right-0 z-50 w-[82vw] max-w-[300px] flex flex-col shadow-2xl transition-transform duration-200 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={chromeBg}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 lg:static shrink-0 bg-surface border-b border-hairline px-3 lg:px-6 py-2.5 lg:py-0 lg:h-[62px] flex items-center gap-2" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="תפריט"
            aria-expanded={menuOpen}
            className="lg:hidden w-10 h-10 -my-1 flex items-center justify-center rounded-lg text-ink hover:bg-canvas active:scale-90 transition-[background-color,transform] shrink-0 cursor-pointer"
          >
            <Menu size={21} strokeWidth={1.9} />
          </button>
          <PageHeader title={title} subtitle={subtitle} actions={actions} className="w-full min-w-0" />
        </header>
        <main className={`flex-1 min-w-0 overflow-x-hidden lg:overflow-auto ${wide ? 'p-3 lg:p-5' : 'p-3 sm:p-5 lg:p-8'}`} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{children}</main>
      </div>
    </div>
  )
}
