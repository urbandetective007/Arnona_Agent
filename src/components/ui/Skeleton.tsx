import { Card } from './Card'

// A gray block with a sheen sweeping over it — stands in for content that is
// still arriving from Supabase.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

// The shape every data page has while it loads — a row of KPI tiles over a
// list card — so the page "fills in" instead of swapping a spinner for a
// screen.
export function PageSkeleton({ tiles = 4, rows = 7 }: { tiles?: number; rows?: number }) {
  return (
    <div role="status" aria-label="טוען נתונים" className="flex flex-col gap-4">
      {tiles > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: tiles }, (_, i) => (
            <Card key={i}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24 mt-3" />
              <Skeleton className="h-2 w-full mt-3" />
            </Card>
          ))}
        </div>
      )}
      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-col gap-2.5 mt-4">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className={`h-9 ${i % 3 === 1 ? 'w-[86%]' : i % 3 === 2 ? 'w-[70%]' : 'w-full'}`} />
          ))}
        </div>
      </Card>
    </div>
  )
}
