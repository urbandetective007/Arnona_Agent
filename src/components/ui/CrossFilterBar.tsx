import { X, Filter } from 'lucide-react'
import type { CrossFilter } from '@/lib/useCrossFilter'

interface CrossFilterBarProps<T, D extends string> {
  cf: CrossFilter<T, D>
  /** Hebrew name of each dimension, shown before the chip value ("שכונה: …"). */
  dimLabels: Record<D, string>
  /** Display text for a raw selected value (defaults to the value itself). */
  valueLabel?: (dim: D, value: string) => string
}

// The row of active chart-click filters at the top of a page. Renders
// nothing until something is selected, so pages without an active
// cross-filter look exactly as before.
export function CrossFilterBar<T, D extends string>({ cf, dimLabels, valueLabel }: CrossFilterBarProps<T, D>) {
  if (!cf.hasSelection()) return null
  const dims = Object.keys(cf.selection) as D[]

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-[10px] border border-brand/20 bg-brand/[0.05] px-3 py-2">
      <Filter size={14} className="text-brand shrink-0" strokeWidth={2} />
      <span className="text-[12.5px] font-semibold text-brand">סינון פעיל:</span>
      {dims.flatMap(dim => (cf.selection[dim] ?? []).map(value => (
        <button
          key={`${dim}:${value}`}
          type="button"
          onClick={() => cf.toggle(dim, value, true)}
          className="inline-flex items-center gap-1 rounded-md bg-surface border border-[#d5dce6] px-2 py-0.5 text-[12.5px] text-ink hover:bg-canvas cursor-pointer"
          aria-label={`הסרת סינון ${dimLabels[dim]}: ${valueLabel?.(dim, value) ?? value}`}
        >
          <span className="text-graphite">{dimLabels[dim]}:</span>
          <span className="font-semibold">{valueLabel?.(dim, value) ?? value}</span>
          <X size={12} strokeWidth={2.4} className="text-subtle" />
        </button>
      )))}
      <button
        type="button"
        onClick={() => cf.clear()}
        className="ms-auto text-[12.5px] font-semibold text-brand hover:text-brand-deep cursor-pointer"
      >
        נקה סינון
      </button>
      <span className="w-full text-[11px] text-subtle">Ctrl+לחיצה על גרף לבחירה מרובה · Esc לניקוי</span>
    </div>
  )
}
