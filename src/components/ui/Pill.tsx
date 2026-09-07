import type { ReactNode } from 'react'

interface PillProps {
  children: ReactNode
  /** Used for segmented-control-style groups of pills (e.g. the date-range switcher). */
  active?: boolean
  className?: string
  onClick?: () => void
}

// Neutral rounded chip — counters ("1 / 5"), small tags ("חדש"), and the
// individual options inside a segmented control. Unlike Badge, it carries
// no status color of its own.
export function Pill({ children, active = false, className = '', onClick }: PillProps) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={[
        'inline-flex items-center rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
        active
          ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(15,26,40,0.08)]'
          : 'bg-transparent text-graphite',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}
