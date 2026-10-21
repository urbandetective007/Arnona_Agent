'use client'

import { useMemo } from 'react'
import { MapPin, Building2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { useBusinesses } from '@/lib/useBusinesses'
import { SOURCE_LABEL, SOURCE_OPTIONS, SOURCE_COLOR, SOURCE_TONE, type BusinessSource } from '@/lib/sources'
import { Card, StatCard, Spinner, EmptyState, CrossFilterBar, AnimatedNumber, LoadingMoreBanner, Badge, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui'
import { useCrossFilter, chartItemProps } from '@/lib/useCrossFilter'
import { AgentScanCard } from '@/components/AgentScanCard'

const NEIGHBORHOOD_DIMS = {
  neighborhood: (b: Business) => b.neighborhood || null,
}
const DIM_LABELS = { neighborhood: 'שכונה' }

const isIndication = (b: Business) => b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני'
const SOURCE_SHORT: Record<BusinessSource, string> = { excel: 'סוכן', manual: 'ידני', promotion: 'קידום' }

// Indication properties per neighborhood, split by where they came from —
// the agent's reports, manual entry or the business promotion department —
// so it's visible that all of them count.
function rankNeighborhoods(businesses: Business[]) {
  const byNeighborhood = new Map<string, Record<BusinessSource, number>>()
  businesses.forEach(b => {
    if (!b.neighborhood || !isIndication(b)) return
    const row = byNeighborhood.get(b.neighborhood) ?? { excel: 0, manual: 0, promotion: 0 }
    row[b.source] += 1
    byNeighborhood.set(b.neighborhood, row)
  })
  return [...byNeighborhood.entries()]
    .map(([neighborhood, bySource]) => ({ neighborhood, bySource, count: bySource.excel + bySource.manual + bySource.promotion }))
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
  const totalBySource = (s: BusinessSource) => rows.reduce((sum, r) => sum + r.bySource[s], 0)
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
        <AgentScanCard
          businesses={businesses}
          cf={cf}
          onPick={() => setTimeout(() => document.getElementById('neighborhood-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)}
        />
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
          <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-1.5 px-4 sm:px-5 py-4 border-b border-hairline">
            <span className="text-[14.5px] font-bold text-ink">דירוג שכונות</span>
            <div className="flex items-center flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-subtle">
              {SOURCE_OPTIONS.map(s => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ background: SOURCE_COLOR[s] }} />{SOURCE_LABEL[s]}
                  {s !== 'excel' && <span className="num">({totalBySource(s)})</span>}
                </span>
              ))}
              <span className="hidden sm:inline">· לחיצה על שכונה מציגה את הנכסים</span>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="אין עדיין נכסים עם אינדיקציה משויכים לשכונה" />
          ) : (
            <div className="flex flex-col gap-1 p-2 sm:p-3">
              {rows.map((r, i) => {
                const item = chartItemProps(cf, 'neighborhood', r.neighborhood, `${r.neighborhood}: ${r.count}`)
                return (
                <div key={r.neighborhood} {...item} className={`${item.className} animate-fade-in flex items-center gap-2 sm:gap-3.5 px-2 sm:px-2.5 py-2.5 rounded-lg ${item['aria-pressed'] ? 'bg-brand/[0.06]' : 'hover:bg-canvas'}`}>
                  <span className="num w-5 sm:w-6 shrink-0 text-[13px] font-bold text-subtle">{i + 1}</span>
                  <span className="w-[88px] sm:w-32 shrink-0 text-[13px] sm:text-[13.5px] font-semibold text-ink truncate">{r.neighborhood}</span>
                  <div className="flex-1 min-w-[40px] h-[22px] bg-canvas rounded-md overflow-hidden">
                    <div className="flex h-full rounded-md overflow-hidden transition-[width] duration-500 ease-out min-w-[10px]" style={{ width: `${(r.count / maxCount) * 100}%` }}>
                      {SOURCE_OPTIONS.map(s => (
                        <span key={s} className="block h-full transition-[width] duration-500 ease-out" style={{ width: `${(r.bySource[s] / r.count) * 100}%`, background: SOURCE_COLOR[s] }} title={`${SOURCE_LABEL[s]}: ${r.bySource[s]}`} />
                      ))}
                    </div>
                  </div>
                  <span className="num w-[52px] sm:w-16 shrink-0 text-start text-[13px] font-bold text-brand"><AnimatedNumber value={r.count} /><span className="hidden sm:inline"> נכסים</span></span>
                  <span className="hidden sm:inline num min-w-24 shrink-0 whitespace-nowrap text-start text-[11.5px] text-subtle">
                    {SOURCE_OPTIONS.filter(s => s !== 'promotion' || r.bySource.promotion > 0).map(s => `${r.bySource[s]} ${SOURCE_SHORT[s]}`).join(' · ')}
                  </span>
                  <span className="num w-9 sm:w-12 shrink-0 text-start text-[12px] text-subtle">
                    <AnimatedNumber value={totalIndication > 0 ? Math.round((r.count / totalIndication) * 100) : 0} suffix="%" />
                  </span>
                </div>
                )
              })}
            </div>
          )}
        </Card>

        {cf.hasSelection() && (
          <div id="neighborhood-details" className="scroll-mt-4">
          <Card padded={false} className="animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <span className="text-[14.5px] font-bold text-ink">הנכסים בשכונות שנבחרו</span>
              <span className="num text-[12.5px] text-subtle">{selectedList.length} נכסים</span>
            </div>
            {selectedList.length === 0 ? (
              <EmptyState title="אין עדיין נכסים באינדיקציה בשכונות שנבחרו" />
            ) : (
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
                    <Td><Badge tone={SOURCE_TONE[b.source]}>{SOURCE_LABEL[b.source]}</Badge></Td>
                    <Td className="text-charcoal">{b.sentToInspector ?? 'לא נשלח לסוקר'}</Td>
                    <Td className="text-charcoal">{b.surveyResultDetail ?? '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            )}
          </Card>
          </div>
        )}
      </div>
    </AppShell>
  )
}
