import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Drop the default padding when the content manages its own (e.g. a table). */
  padded?: boolean
}

// The one card shell every screen in the redesign is built from: white
// surface, hairline border, soft shadow, 12px radius. Replaces the
// hand-rolled `{ background: '#fff', borderRadius: 16, boxShadow: ... }`
// object every page used to define separately.
export function Card({ children, className = '', style, padded = true }: CardProps) {
  return (
    <div
      className={`bg-surface border border-hairline rounded-xl shadow-[0_1px_2px_rgba(15,26,40,0.03)] ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
