'use client'

import { useMemo } from 'react'
import { MapPin, Building2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { useBusinesses } from '@/lib/useBusinesses'
import { Card, StatCard, Spinner, EmptyState, CrossFilterBar, AnimatedNumber, LoadingMoreBanner, Badge, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui'
import { useCrossFilter, chartItemProps } from '@/lib/useCrossFilter'

const NEIGHBORHOOD_DIMS = {
  neighborhood: (b: Business) => b.neighborhood || null,
}
const DIM_LABELS = { neighborhood: 'שכונה' }

const isIndication = (b: Business) => b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני'
const AGENT_COLOR = '#024ad8'
const MANUAL_COLOR = '#f59e0b'

// Indication properties per neighborhood, split by where they came from —
// the agent's reports or manual entry — so it's visible that both count.
function rankNeighborhoods(businesses: Business[]) {
  const byNeighborhood = new Map<string, { agent: number; manual: number }>()
  businesses.forEach(b => {
    if (!b.neighborhood || !isIndication(b)) return
    const row = byNeighborhood.get(b.neighborhood) ?? { agent: 0, manual: 0 }
    if (b.source === 'manual') row.manual += 1
    else row.agent += 1
    byNeighborhood.set(b.neighborhood, row)
  })
  return [...byNeighborhood.entries()]
    .map(([neighborhood, r]) => ({ neighborhood, ...r, count: r.agent + r.manual }))
    .sort((a, b) => b.count - a.count)
}

export default function NeighborhoodsPage() {
  const ready = useRequireRole(['employee', 'manager'])
  const { businesses, loading, loadingMore } = useBusinesses()


  const cf = useCrossFilter(businesses, NEIGHBORHOOD_DIMS)
  // The ranking chart ignores its own selection (highlight mode); the KPI
  // cards follow the selection.
  const chartList = cf.filteredExcept('neighborhood')
  const rows = useMemo(() => rankNeighborhoods(chartList), [chartList])
  const selectedRows = useMemo(() => rankNeighborhoods(cf.filtered), [cf.filtered])

  const totalIndication = rows.reduce((sum, r) => sum + r.count, 0)
  const totalManual = rows.reduce((sum, r) => sum + r.manual, 0)
  const selectedList = useMemo(
    () => cf.filtered.filter(b => b.neighborhood && isIndication(b)).sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, 'he') || a.name.localeCompare(b.name, 'he')),
    [cf.filtered]
  )
  const maxCount = Math.max(...rows.map(r => r.count), 1)

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="פילוח שכונות">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  return (
    <AppShell
      title="פילוח שכונות"
      subtitle={`${rows.length.toLocaleString('he')} שכונות עם נכסים באינדיקציה · מדורגות לפי כמות`}
    >
      <div className="flex flex-col gap-5">
        <LoadingMoreBanner progress={loadingMore} />
        <CrossFilterBar cf={cf} dimLabels={DIM_LABELS} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label={cf.hasSelection() ? 'נכסים באינדיקציה בבחירה' : 'שכונות עם אינדיקציה'}
            value={<span className="num"><AnimatedNumber value={cf.hasSelection() ? selectedRows.reduce((sum, r) => sum + r.count, 0) : rows.length} /></span>}
            icon={<MapPin size={16} className="text-subtle" strokeWidth={1.8} />}
          />
          <StatCard
            label={cf.hasSelection() ? 'השכונה המובילה בבחירה' : 'השכונה המובילה'}
            value={<span className="num">{selectedRows[0]?.neighborhood ?? '—'}</span>}
            icon={<Building2 size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={selectedRows[0] && (
              <span className="text-[12px] text-subtle"><span className="num font-semibold text-ink"><AnimatedNumber value={selectedRows[0].count} /></span> נכסים באינדיקציה</span>
            )}
          />
        </div>

        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <span className="text-[14.5px] font-bold text-ink">דירוג שכונות</span>
            <div className="flex items-center gap-3.5 text-[11.5px] text-subtle">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: AGENT_COLOR }} />סוכן ארנונה</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: MANUAL_COLOR }} />הוזן ידנית <span className="num">({totalManual})</span></span>
              <span>· לחיצה על שכונה מציגה את הנכסים</span>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="אין עדיין נכסים עם אינדיקציה משויכים לשכונה" />
          ) : (
            <div className="flex flex-col gap-1 p-3">
              {rows.map((r, i) => {
                const item = chartItemProps(cf, 'neighborhood', r.neighborhood, `${r.neighborhood}: ${r.count}`)
                return (
                <div key={r.neighborhood} {...item} className={`${item.className} animate-fade-in flex items-center gap-3.5 px-2.5 py-2.5 rounded-lg ${item['aria-pressed'] ? 'bg-brand/[0.06]' : 'hover:bg-canvas'}`}>
                  <span className="num w-6 shrink-0 text-[13px] font-bold text-subtle">{i + 1}</span>
                  <span className="w-32 shrink-0 text-[13.5px] font-semibold text-ink truncate">{r.neighborhood}</span>
                  <div className="flex-1 h-[22px] bg-canvas rounded-md overflow-hidden">
                    <div className="flex h-full rounded-md overflow-hidden transition-[width] duration-500 ease-out min-w-[10px]" style={{ width: `${(r.count / maxCount) * 100}%` }}>
                      <span className="block h-full transition-[width] duration-500 ease-out" style={{ width: `${(r.agent / r.count) * 100}%`, background: AGENT_COLOR }} title={`סוכן ארנונה: ${r.agent}`} />
                      <span className="block h-full transition-[width] duration-500 ease-out" style={{ width: `${(r.manual / r.count) * 100}%`, background: MANUAL_COLOR }} title={`הוזן ידנית: ${r.manual}`} />
                    </div>
                  </div>
                  <span className="num w-16 shrink-0 text-start text-[13px] font-bold text-brand"><AnimatedNumber value={r.count} /> נכסים</span>
                  <span className="num w-24 shrink-0 text-start text-[11.5px] text-subtle">{r.agent} סוכן · {r.manual} ידני</span>
                  <span className="num w-12 shrink-0 text-start text-[12px] text-subtle">
                    <AnimatedNumber value={totalIndication > 0 ? Math.round((r.count / totalIndication) * 100) : 0} suffix="%" />
                  </span>
                </div>
                )
              })}
            </div>
          )}
        </Card>

        {cf.hasSelection() && (
          <Card padded={false} className="animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <span className="text-[14.5px] font-bold text-ink">הנכסים בשכונות שנבחרו</span>
              <span className="num text-[12.5px] text-subtle">{selectedList.length} נכסים</span>
            </div>
            <Table>
              <Thead>
                <Tr>
                  <Th>נכס</Th>
                  <Th>סוג עסק</Th>
                  <Th>כתובת</Th>
                  <Th>שכונה</Th>
                  <Th>מקור</Th>
                  <Th>סוקר</Th>
                  <Th>תוצאת סקר</Th>
                </Tr>
              </Thead>
              <Tbody>
                {selectedList.map(b => (
                  <Tr key={b.id}>
                    <Td className="font-semibold">{b.name}</Td>
                    <Td className="text-charcoal">{b.type || '—'}</Td>
                    <Td className="text-charcoal">{b.address}</Td>
                    <Td className="text-charcoal">{b.neighborhood}</Td>
                    <Td><Badge tone={b.source === 'manual' ? 'mid' : 'neutral'}>{b.source === 'manual' ? 'הוזן ידנית' : 'סוכן ארנונה'}</Badge></Td>
                    <Td className="text-charcoal">{b.sentToInspector ?? 'לא נשלח לסוקר'}</Td>
                    <Td className="text-charcoal">{b.surveyResultDetail ?? '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
