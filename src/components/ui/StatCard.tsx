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
  className?: string
}

// One KPI tile. Every dashboard-style screen (מרכז בקרה, מעקב תוצאות סקר)
// renders 3-5 of these in a grid — this is the shared shape so each page
// stops redefining its own metricCard style object.
export function StatCard({ label, value, icon, tone = 'default', footer, className = '' }: StatCardProps) {
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
        <div className="relative mt-2.5">
          <p className="num text-[32px] font-bold leading-none tracking-tight text-white">{value}</p>
          {footer && <div className="mt-1.5">{footer}</div>}
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
      <div className="mt-2.5">
        <p className="num text-[32px] font-bold leading-none tracking-tight text-ink">{value}</p>
        {footer && <div className="mt-1.5">{footer}</div>}
      </div>
    </Card>
  )
}
