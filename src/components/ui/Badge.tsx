import type { ReactNode } from 'react'

export type BadgeTone = 'high' | 'mid' | 'check' | 'clear' | 'brand' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  high:    'bg-high/10 text-high',
  mid:     'bg-mid/10 text-mid',
  check:   'bg-check/10 text-check',
  clear:   'bg-clear/10 text-clear',
  brand:   'bg-brand/10 text-brand',
  neutral: 'bg-ink/[0.06] text-charcoal',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

// Small status chip — "אינדיקציה גבוהה", "פער בסיווג", the funnel's
// bottleneck tag, etc. Tones map 1:1 to the semantic tokens in globals.css
// so a status always reads the same color everywhere in the app.
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  )
}
