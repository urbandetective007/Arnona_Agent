'use client'

import { useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'

type ToastTone = 'success' | 'info'
interface ToastItem { id: number; message: string; tone: ToastTone }

const DURATION_MS = 3500
let nextId = 1
let listener: ((t: ToastItem) => void) | null = null

/** Shows a short confirmation that slides in from the top and leaves on its own. */
export function toast(message: string, tone: ToastTone = 'success') {
  listener?.({ id: nextId++, message, tone })
}

// Mounted once in the root layout. One toast at a time: a new one replaces
// the current one rather than stacking, which suits the short "saved" /
// "sent" confirmations it's used for.
export function Toaster() {
  const [item, setItem] = useState<ToastItem | null>(null)

  useEffect(() => {
    listener = setItem
    return () => { listener = null }
  }, [])

  useEffect(() => {
    if (!item) return
    const t = setTimeout(() => setItem(null), DURATION_MS)
    return () => clearTimeout(t)
  }, [item])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[60] flex justify-center px-4 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
    >
      {item && (
        <div
          key={item.id}
          className="toast-in relative overflow-hidden max-w-md w-full sm:w-auto flex items-start gap-3 rounded-xl bg-surface border border-hairline shadow-[0_14px_32px_-12px_rgba(15,26,40,0.35)] ps-3.5 pe-4 py-3 pointer-events-auto"
        >
          <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${item.tone === 'success' ? 'bg-clear/12 text-clear' : 'bg-brand/10 text-brand'}`}>
            {item.tone === 'success' ? <Check size={15} strokeWidth={3} /> : <Info size={15} strokeWidth={2.4} />}
          </span>
          <p className="text-[13.5px] font-semibold text-ink leading-snug pt-1">{item.message}</p>
          <span
            aria-hidden="true"
            className={`toast-timer absolute bottom-0 inset-x-0 h-[3px] origin-right ${item.tone === 'success' ? 'bg-clear' : 'bg-brand'}`}
            style={{ ['--toast-ms' as string]: `${DURATION_MS}ms` }}
          />
        </div>
      )}
    </div>
  )
}
