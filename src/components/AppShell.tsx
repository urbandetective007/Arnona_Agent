'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Landmark, ShieldCheck, LogOut } from 'lucide-react'
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

function AppShellInner({ children, title, subtitle, actions }: AppShellProps) {
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

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar — order-2 puts it on the visual right under dir="rtl" */}
      <aside
        className="w-60 shrink-0 order-2 sticky top-0 h-screen flex flex-col"
        style={{ background: 'linear-gradient(180deg, var(--color-chrome) 0%, var(--color-chrome-deep) 100%)' }}
      >
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-chrome-hairline">
          <Landmark size={24} strokeWidth={1.7} className="text-brand-light shrink-0" />
          <div className="min-w-0">
            <div className="text-white font-bold text-[15px] truncate">סוכן ארנונה</div>
            <div className="text-chrome-graphite text-[11.5px] mt-0.5">עיריית ירושלים</div>
          </div>
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
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] transition-colors ${
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

        <div className="p-3 border-t border-chrome-hairline flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-chrome-ink text-[12.5px] font-semibold truncate">{roleOption?.label ?? '—'}</div>
            <div className="text-chrome-subtle text-[11px]">מחובר/ת</div>
          </div>
          <button
            type="button"
            onClick={async () => { await logout(); router.push('/login') }}
            aria-label="יציאה"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-chrome-graphite hover:text-chrome-ink hover:bg-white/5 transition-colors shrink-0"
          >
            <LogOut size={17} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 order-1 flex flex-col">
        <header className="h-[62px] shrink-0 bg-surface border-b border-hairline flex items-center px-6">
          <PageHeader title={title} subtitle={subtitle} actions={actions} className="w-full" />
        </header>
        <main className="flex-1 min-w-0 overflow-auto p-5 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
