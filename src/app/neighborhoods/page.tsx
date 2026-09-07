'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Building2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { Card, StatCard, Spinner, EmptyState } from '@/components/ui'

export default function NeighborhoodsPage() {
  const ready = useRequireRole(['employee', 'manager'])
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setBusinesses(cached)
      setLoading(false)
    }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const rows = useMemo(() => {
    const byNeighborhood = new Map<string, number>()
    businesses.forEach(b => {
      if (!b.neighborhood) return
      if (b.suspicionRating !== 'גבוה' && b.suspicionRating !== 'בינוני') return
      byNeighborhood.set(b.neighborhood, (byNeighborhood.get(b.neighborhood) ?? 0) + 1)
    })
    return [...byNeighborhood.entries()]
      .map(([neighborhood, count]) => ({ neighborhood, count }))
      .sort((a, b) => b.count - a.count)
  }, [businesses])

  const totalIndication = rows.reduce((sum, r) => sum + r.count, 0)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="שכונות עם אינדיקציה"
            value={<span className="num">{rows.length.toLocaleString('he')}</span>}
            icon={<MapPin size={16} className="text-subtle" strokeWidth={1.8} />}
          />
          <StatCard
            label="השכונה המובילה"
            value={<span className="num">{rows[0]?.neighborhood ?? '—'}</span>}
            icon={<Building2 size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={rows[0] && (
              <span className="text-[12px] text-subtle"><span className="num font-semibold text-ink">{rows[0].count}</span> נכסים באינדיקציה</span>
            )}
          />
        </div>

        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <span className="text-[14.5px] font-bold text-ink">דירוג שכונות</span>
            <span className="text-[11.5px] text-subtle">לפי מספר נכסים באינדיקציה</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="אין עדיין נכסים עם אינדיקציה משויכים לשכונה" />
          ) : (
            <div className="flex flex-col gap-1 p-3">
              {rows.map((r, i) => (
                <div key={r.neighborhood} className="flex items-center gap-3.5 px-2.5 py-2.5 rounded-lg">
                  <span className="num w-6 shrink-0 text-[13px] font-bold text-subtle">{i + 1}</span>
                  <span className="w-32 shrink-0 text-[13.5px] font-semibold text-ink truncate">{r.neighborhood}</span>
                  <div className="flex-1 h-[22px] bg-canvas rounded-md overflow-hidden">
                    <span
                      className="block h-full rounded-md min-w-[10px]"
                      style={{ width: `${(r.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, #a9c8ff 0%, #024ad8 100%)' }}
                    />
                  </div>
                  <span className="num w-16 shrink-0 text-start text-[13px] font-bold text-brand">{r.count} נכסים</span>
                  <span className="num w-12 shrink-0 text-start text-[12px] text-subtle">
                    {totalIndication > 0 ? Math.round((r.count / totalIndication) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
