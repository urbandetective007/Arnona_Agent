import type { ReactNode } from 'react'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  /** `brand` renders the dark gradient variant used for the headline KPI. */
  tone?: 'default' | 'brand'
  /** Trend row, progress bar, or any small note under the value. */
  footer?: ReactNode
  /** A small real-data trend chart, rendered beside the value (never a fabricated series). */
  sparkline?: ReactNode
  className?: string
}

// One KPI tile. Every dashboard-style screen (מרכז בקרה, מעקב תוצאות סקר)
// renders 3-5 of these in a grid — this is the shared shape so each page
// stops redefining its own metricCard style object.
export function StatCard({ label, value, icon, tone = 'default', footer, sparkline, className = '' }: StatCardProps) {
  const valueBlock = (
    <div>
      <p className={`num text-[32px] font-bold leading-none tracking-tight ${tone === 'brand' ? 'text-white' : 'text-ink'}`}>{value}</p>
      {footer && <div className="mt-1.5">{footer}</div>}
    </div>
  )

  if (tone === 'brand') {
    return (
      <div
        className={`relative overflow-hidden rounded-xl p-4 sm:p-5 ${className}`}
        style={{ background: 'linear-gradient(135deg, #062b6e 0%, #024ad8 100%)' }}
      >
        <div className="absolute -top-8 -start-8 w-32 h-32 rounded-full bg-white/6" />
        <div className="relative flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-[#b9cdf7]">{label}</span>
          {icon}
        </div>
        <div className="relative mt-2.5 flex items-end justify-between gap-3">
          {valueBlock}
          {sparkline}
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-graphite">{label}</span>
        {icon}
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-3">
        {valueBlock}
        {sparkline}
      </div>
    </Card>
  )
}
