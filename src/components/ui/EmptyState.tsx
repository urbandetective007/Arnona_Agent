import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// Shared "nothing here yet" block — replaces the ad-hoc empty-state markup
// each page used to write inline (e.g. Dashboard's "אין נתונים" branch).
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-16 px-6 ${className}`}>
      {icon && <div className="text-subtle">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-graphite max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
