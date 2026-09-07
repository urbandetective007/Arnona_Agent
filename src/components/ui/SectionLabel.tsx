import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  /** `light` for use on the dark sidebar chrome. */
  tone?: 'default' | 'light'
  className?: string
}

// Small caption label — sidebar nav group headers, dashboard "eyebrow"
// text. Deliberately no uppercase/letter-spacing: that convention reads as
// SHOUTING in Hebrew rather than as quiet hierarchy, so weight + color do
// the work instead (per the design direction notes on the canvas).
export function SectionLabel({ children, tone = 'default', className = '' }: SectionLabelProps) {
  return (
    <div className={`text-[10.5px] font-semibold ${tone === 'light' ? 'text-chrome-subtle' : 'text-graphite'} ${className}`}>
      {children}
    </div>
  )
}
