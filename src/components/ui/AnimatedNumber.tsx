'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  /** Formatting for each displayed frame (defaults to Hebrew locale grouping). */
  format?: (n: number) => string
  /** Appended after the number, e.g. "%". */
  suffix?: string
  /** Tween length in ms. */
  duration?: number
}

const defaultFormat = (n: number) => n.toLocaleString('he')

// A number that counts to its new value when it changes (e.g. when a chart
// click cross-filters the page) instead of jumping. The first render shows
// the value as-is, so page load looks exactly as before; users who prefer
// reduced motion always get the final value immediately.
export function AnimatedNumber({ value, format = defaultFormat, suffix = '', duration = 500 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = t >= 1 ? value : Math.round(from + (value - from) * eased)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(display)}{suffix}</>
}
