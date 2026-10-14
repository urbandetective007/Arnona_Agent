import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** `page` = the AppShell top bar; `section` = a smaller heading inside a Card. */
  size?: 'page' | 'section'
  className?: string
}

// Title + subtitle + actions row, reused for the AppShell top bar and for
// the section headers inside cards ("משפך האכיפה · מסריקה ועד גביית פער").
export function PageHeader({ title, subtitle, actions, size = 'page', className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="min-w-0">
        {size === 'page' ? (
          <h1 className="text-[17px] font-bold tracking-tight text-ink truncate">{title}</h1>
        ) : (
          <span className="text-[14.5px] font-bold text-ink">{title}</span>
        )}
        {subtitle && (
          <div className={size === 'page' ? 'text-xs text-graphite mt-0.5' : 'text-xs text-subtle mt-0.5'}>
            {subtitle}
          </div>
        )}
      </div>
      {/* On a phone the actions drop to their own row (and scroll sideways if they still don't fit). */}
      {actions && <div className="flex items-center gap-2 shrink-0 max-w-full overflow-x-auto">{actions}</div>}
    </div>
  )
}
