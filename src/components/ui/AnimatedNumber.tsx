'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  /** Formatting for each displayed frame (defaults to Hebrew locale grouping). */
  format?: (n: number) => string
  /** Appended after the number, e.g. "%". */
  suffix?: string
  /** Tween length in ms, for later changes (the first count-up is a little slower). */
  duration?: number
}

const MOUNT_DURATION = 1100

const defaultFormat = (n: number) => n.toLocaleString('he')

// A number that counts up from 0 when it first appears (a dashboard opening
// with its figures running up to their real values), and then counts to each
// new value when it changes (e.g. when a chart click cross-filters the page)
// instead of jumping. Users who prefer reduced motion always get the final
// value immediately.
export function AnimatedNumber({ value, format = defaultFormat, suffix = '', duration = 500 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)
  const mountedRef = useRef(false)

  useEffect(() => {
    const from = displayRef.current
    const first = !mountedRef.current
    mountedRef.current = true
    if (from === value) return
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const length = first ? MOUNT_DURATION : duration
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / length)
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
