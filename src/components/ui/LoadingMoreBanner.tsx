import { Loader2 } from 'lucide-react'
import type { LoadingMore } from '@/lib/useBusinesses'

// Shown while a page's data is still arriving in pages of 1,000 — so partial
// totals aren't mistaken for final ones.
export function LoadingMoreBanner({ progress }: { progress: LoadingMore | null }) {
  if (!progress) return null
  return (
    <div role="status" className="flex items-center gap-2 rounded-[10px] border border-brand/20 bg-brand/[0.05] px-3.5 py-2 text-[12.5px] text-brand">
      <Loader2 size={14} className="animate-spin shrink-0" strokeWidth={2.2} />
      <span>
        טוען עוד נכסים… נטענו <strong className="num font-bold">{progress.loaded.toLocaleString('he')}</strong>
        {progress.total !== null && <> מתוך <strong className="num font-bold">{progress.total.toLocaleString('he')}</strong></>}
        . המספרים יתעדכנו עם סיום הטעינה.
      </span>
    </div>
  )
}
