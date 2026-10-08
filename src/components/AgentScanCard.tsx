'use client'

import { useMemo } from 'react'
import { Radar } from 'lucide-react'
import { Card, Badge, Spinner, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui'
import type { Business } from '@/lib/types'
import type { CrossFilter } from '@/lib/useCrossFilter'
import { chartItemProps } from '@/lib/useCrossFilter'
import { useAgentProgress, scanByNeighborhood, NO_NEIGHBORHOOD } from '@/lib/agentProgress'

const isIndication = (b: Business) => b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני'

// "Where is the agent": the neighborhood it's in, how far through the address
// list it is, and every neighborhood's scan status in the order it goes
// through them. Clicking a neighborhood filters the page to it (same
// cross-filter as the ranking below).
export function AgentScanCard({ businesses, cf, onPick }: {
  businesses: Business[]
  cf: CrossFilter<Business, 'neighborhood'>
  onPick?: () => void
}) {
  const { progress, error } = useAgentProgress()

  const suspectsBy = useMemo(() => {
    const m = new Map<string, number>()
    businesses.forEach(b => { if (b.neighborhood && isIndication(b)) m.set(b.neighborhood, (m.get(b.neighborhood) ?? 0) + 1) })
    return m
  }, [businesses])

  const rows = useMemo(() => (progress ? scanByNeighborhood(progress) : []), [progress])
  const current = rows.find(r => r.status === 'current')
  const named = rows.filter(r => r.name !== NO_NEIGHBORHOOD)
  const doneCount = named.filter(r => r.status === 'done').length
  const pct = progress && progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0

  return (
    <Card padded={false}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-hairline">
        <Radar size={17} className="text-brand" strokeWidth={1.9} />
        <span className="text-[14.5px] font-bold text-ink">סריקת הסוכן</span>
      </div>

      {error ? (
        <p className="px-5 py-6 text-[13px] text-charcoal">לא הצלחנו לקרוא כרגע את מצב הסוכן מ-GitHub. שאר הנתונים בעמוד לא מושפעים — נסו לרענן בעוד כמה דקות.</p>
      ) : !progress ? (
        <div className="py-8"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 py-4">
            <div>
              <div className="text-[12px] font-semibold text-graphite">איפה הסוכן עכשיו</div>
              <div className="text-[18px] font-bold text-ink mt-1">{current?.name ?? '—'}</div>
              {progress.nextAddress && (
                <div className="text-[12px] text-subtle mt-0.5">הכתובת הבאה בתור: <span className="text-charcoal font-semibold">{progress.nextAddress}</span></div>
              )}
            </div>
            <div>
              <div className="text-[12px] font-semibold text-graphite">כתובות שנסרקו בסבב הנוכחי</div>
              <div className="text-[18px] font-bold text-ink mt-1 num">
                {progress.index.toLocaleString('he')} <span className="text-[13px] font-normal text-subtle">מתוך {progress.total.toLocaleString('he')} ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-canvas rounded-full overflow-hidden mt-2">
                <span className="block h-full bg-brand-light rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-graphite">שכונות שהסריקה בהן הושלמה</div>
              <div className="text-[18px] font-bold text-ink mt-1 num">
                {doneCount} <span className="text-[13px] font-normal text-subtle">מתוך {named.length}</span>
              </div>
            </div>
          </div>

          <div className="max-h-[380px] overflow-auto border-t border-hairline">
            <Table className="rounded-none border-0">
              <Thead>
                <Tr>
                  <Th>#</Th>
                  <Th>שכונה</Th>
                  <Th>סטטוס סריקה</Th>
                  <Th>כתובות</Th>
                  <Th>נסרקו</Th>
                  <Th>חשודים שנמצאו</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((r, i) => {
                  const clickable = r.name !== NO_NEIGHBORHOOD
                  const item = clickable ? chartItemProps(cf, 'neighborhood', r.name, r.name) : null
                  const scanPct = r.count > 0 ? Math.round((r.scanned / r.count) * 100) : 0
                  return (
                    <Tr
                      key={r.name}
                      {...(item ?? {})}
                      onClick={item ? (e => { item.onClick(e); onPick?.() }) : undefined}
                      className={`${item?.className ?? ''} ${r.status === 'current' ? 'bg-brand/[0.05]' : ''} ${item?.['aria-pressed'] ? 'bg-brand/[0.08]' : ''}`}
                    >
                      <Td className="num text-subtle">{i + 1}</Td>
                      <Td className="font-semibold">{r.name}</Td>
                      <Td>
                        {r.status === 'done' ? <Badge tone="clear">הושלמה</Badge>
                          : r.status === 'current' ? <Badge tone="brand">בסריקה · {scanPct}%</Badge>
                          : <Badge tone="neutral">טרם נסרקה</Badge>}
                      </Td>
                      <Td className="num">{r.count.toLocaleString('he')}</Td>
                      <Td className="num">{r.scanned.toLocaleString('he')}</Td>
                      <Td className="num font-semibold">{clickable ? (suspectsBy.get(r.name) ?? 0) : '—'}</Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </div>
        </>
      )}
    </Card>
  )
}
