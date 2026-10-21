'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface SegmentedControlProps<K extends string | number> {
  options: { key: K; label: ReactNode }[]
  value: K
  onChange: (key: K) => void
  ariaLabel?: string
  className?: string
}

// A row of options with one white "thumb" that slides to the chosen option
// (the date-range switcher, the map's surveyor-status views). Same look as
// the old group of Pills, but the selection visibly travels instead of
// blinking from one option to the next.
export function SegmentedControl<K extends string | number>({ options, value, onChange, ariaLabel, className = '' }: SegmentedControlProps<K>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)
  // The first placement jumps straight to the option; only later changes slide.
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const measure = () => {
      const active = group.querySelector<HTMLElement>('[aria-pressed="true"]')
      setThumb(active ? { left: active.offsetLeft, width: active.offsetWidth } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(group)
    return () => ro.disconnect()
  }, [value, options])

  useLayoutEffect(() => {
    if (thumb && !animate) {
      const frame = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(frame)
    }
  }, [thumb, animate])

  return (
    <div ref={groupRef} role="group" aria-label={ariaLabel} className={`relative flex bg-canvas rounded-lg p-0.5 gap-0.5 ${className}`}>
      {thumb && (
        <span
          aria-hidden="true"
          className={`absolute top-0.5 bottom-0.5 rounded-md bg-surface shadow-[0_1px_2px_rgba(15,26,40,0.08)] ${animate ? 'motion-safe:transition-[left,width] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(0.3,1.3,0.5,1)]' : ''}`}
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map(opt => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={`relative inline-flex items-center rounded-md px-2.5 py-1 text-[12.5px] font-semibold cursor-pointer transition-colors ${active ? 'text-ink' : 'text-graphite hover:text-charcoal'}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
