'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { Card, Button, Input, Select, Spinner, EmptyState } from '@/components/ui'

const JerusalemMap = dynamic(() => import('@/components/JerusalemMap'), {
  ssr: false,
  loading: () => <Spinner fullHeight />,
})

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']
const RATING_COLORS: Record<string, string> = {
  'גבוה': '#c8102e',
  'בינוני': '#c2410c',
  'דרוש בדיקה': '#7c8ba0',
  'לא חשוד': '#0f7a4a',
}

export default function MapPage() {
  const ready = useRequireRole(['employee', 'manager'])
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter, setTypeFilter] = useState('הכל')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('הכל')
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  const types = useMemo(() => [...new Set(businesses.map(b => b.type).filter(Boolean))].sort(), [businesses])
  const neighborhoods = useMemo(() => [...new Set(businesses.map(b => b.neighborhood).filter(Boolean))].sort(), [businesses])
  const ratingsInUse = useMemo(() => ALL_RATINGS.filter(r => businesses.some(b => b.suspicionRating === r)), [businesses])

  const filtered = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const matchesSearch = !q || [b.name, b.address, b.type, b.neighborhood ?? '', b.propertyOwners ?? ''].some(s => s.toLowerCase().includes(q))
    return matchesSearch
      && (ratingFilter === 'הכל' || b.suspicionRating === ratingFilter)
      && (typeFilter === 'הכל' || b.type === typeFilter)
      && (neighborhoodFilter === 'הכל' || b.neighborhood === neighborhoodFilter)
  }), [businesses, search, ratingFilter, typeFilter, neighborhoodFilter])

  const activeFilterCount = [ratingFilter, typeFilter, neighborhoodFilter].filter(f => f !== 'הכל').length
  const ratingCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filtered.forEach(b => counts.set(b.suspicionRating, (counts.get(b.suspicionRating) ?? 0) + 1))
    return ratingsInUse.map(r => ({ rating: r, count: counts.get(r) ?? 0 }))
  }, [filtered, ratingsInUse])

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="מפת נכסים">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  return (
    <AppShell title="מפת נכסים" subtitle={`מציג ${filtered.length.toLocaleString('he')} מתוך ${businesses.length.toLocaleString('he')} עסקים`}>
      <div className="flex flex-col gap-4 h-full">
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-subtle pointer-events-none" strokeWidth={1.9} />
              <Input
                type="text"
                placeholder="חיפוש לפי שם, כתובת, סוג עסק..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full ps-9"
              />
            </div>
            <Button
              variant="secondary"
              icon={<SlidersHorizontal size={15} strokeWidth={1.9} />}
              onClick={() => setFiltersOpen(o => !o)}
            >
              סננים{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            {(search || activeFilterCount > 0) && (
              <Button
                variant="ghost"
                icon={<X size={15} strokeWidth={1.9} />}
                onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל'); setNeighborhoodFilter('הכל') }}
              >
                נקה סינון
              </Button>
            )}

            <div className="flex items-center gap-2 ms-auto flex-wrap">
              {ratingCounts.map(({ rating, count }) => (
                <span key={rating} className="flex items-center gap-1.5 text-[12.5px] text-charcoal">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RATING_COLORS[rating] }} />
                  <span className="num font-semibold text-ink">{count}</span> {rating}
                </span>
              ))}
            </div>
          </div>

          {filtersOpen && (
            <div className="flex items-center gap-3 flex-wrap mt-3.5 pt-3.5 border-t border-hairline">
              <Select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
                <option value="הכל">כל הדירוגים</option>
                {ratingsInUse.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
              <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="הכל">כל סוגי העסק</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={neighborhoodFilter} onChange={e => setNeighborhoodFilter(e.target.value)}>
                <option value="הכל">כל השכונות</option>
                {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          )}
        </Card>

        {businesses.length === 0 ? (
          <Card>
            <EmptyState title="אין עסקים להצגה על המפה" description="העלה דוח כדי להתחיל לראות נכסים על המפה." />
          </Card>
        ) : (
          <div className="flex-1 min-h-[560px]">
            {/* JerusalemMap draws its own rounded border + shadow, so it isn't
                nested inside a second Card border here. */}
            <JerusalemMap businesses={filtered} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
