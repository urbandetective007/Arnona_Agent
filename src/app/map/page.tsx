'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import { useRole } from '@/lib/useRole'
import { useBusinesses } from '@/lib/useBusinesses'
import { Card, Button, Input, Select, Spinner, EmptyState, LoadingMoreBanner, Pill } from '@/components/ui'
import { SURVEY_RESULT_OPTIONS, NO_SURVEY_RESULT, NOT_SENT, inspectorStatus, surveyResult } from '@/lib/surveyStatus'
import type { Business } from '@/lib/types'

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

// Which properties the map shows by surveyor status — a segmented control in
// the toolbar, so the current view is always visible and one click away from
// the others. "הוחלט לא לשלוח לסקר" shows only under "הכל".
const SURVEYOR_VIEWS = [
  { key: 'notSent', label: 'טרם נשלחו לסוקר', test: (b: Business) => inspectorStatus(b) === NOT_SENT },
  { key: 'sent', label: 'נשלחו לסוקר', test: (b: Business) => b.sentToInspector === 'נשלח לסוקר' },
  { key: 'all', label: 'הכל', test: () => true },
] as const
type SurveyorView = typeof SURVEYOR_VIEWS[number]['key']

export default function MapPage() {
  const ready = useRequireRole(['employee', 'manager'])
  // Only employees can correct a location by hand; managers view.
  const canEdit = useRole() === 'employee'
  // /map?fix=<address> opens the manual location fix for that address.
  const [fixKey] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('fix')))
  const { businesses, loading, loadingMore } = useBusinesses()
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter, setTypeFilter] = useState('הכל')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('הכל')
  // The map is for deciding what to send to the field, so by default it shows
  // only properties not sent to the surveyor yet — a surveyed property no
  // longer reads as an open suspicion.
  const [surveyorView, setSurveyorView] = useState<SurveyorView>('notSent')
  const [surveyFilter, setSurveyFilter] = useState('הכל')
  const [filtersOpen, setFiltersOpen] = useState(false)


  const types = useMemo(() => [...new Set(businesses.map(b => b.type).filter(Boolean))].sort(), [businesses])
  const neighborhoods = useMemo(() => [...new Set(businesses.map(b => b.neighborhood).filter(Boolean))].sort(), [businesses])
  const ratingsInUse = useMemo(() => ALL_RATINGS.filter(r => businesses.some(b => b.suspicionRating === r)), [businesses])

  // Everything but the surveyor view — the view's counts are taken from this,
  // so each option says how many it would show with the other filters applied.
  const filteredExceptView = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const matchesSearch = !q || [b.name, b.address, b.type, b.neighborhood ?? ''].some(s => s.toLowerCase().includes(q))
    return matchesSearch
      && (ratingFilter === 'הכל' || b.suspicionRating === ratingFilter)
      && (typeFilter === 'הכל' || b.type === typeFilter)
      && (neighborhoodFilter === 'הכל' || b.neighborhood === neighborhoodFilter)
      && (surveyFilter === 'הכל' || surveyResult(b) === surveyFilter)
  }), [businesses, search, ratingFilter, typeFilter, neighborhoodFilter, surveyFilter])
  const viewCounts = useMemo(
    () => Object.fromEntries(SURVEYOR_VIEWS.map(v => [v.key, filteredExceptView.filter(v.test).length])) as Record<SurveyorView, number>,
    [filteredExceptView]
  )
  const filtered = useMemo(() => {
    const view = SURVEYOR_VIEWS.find(v => v.key === surveyorView)!
    return filteredExceptView.filter(view.test)
  }, [filteredExceptView, surveyorView])

  const activeFilterCount = [ratingFilter, typeFilter, neighborhoodFilter, surveyFilter].filter(f => f !== 'הכל').length
  function clearFilters() {
    setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל'); setNeighborhoodFilter('הכל')
    setSurveyFilter('הכל'); setSurveyorView('notSent')
  }
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
        <LoadingMoreBanner progress={loadingMore} />
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
            <div className="flex bg-canvas rounded-lg p-0.5 gap-0.5" role="group" aria-label="סטטוס סוקר">
              {SURVEYOR_VIEWS.map(v => (
                <Pill key={v.key} active={surveyorView === v.key} onClick={() => setSurveyorView(v.key)}>
                  {v.label} <span className="num ms-1 text-subtle font-normal">({viewCounts[v.key].toLocaleString('he')})</span>
                </Pill>
              ))}
            </div>
            {(search || activeFilterCount > 0 || surveyorView !== 'notSent') && (
              <Button
                variant="ghost"
                icon={<X size={15} strokeWidth={1.9} />}
                onClick={clearFilters}
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
              <Select value={surveyFilter} onChange={e => setSurveyFilter(e.target.value)}>
                <option value="הכל">כל תוצאות הסקר</option>
                {SURVEY_RESULT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                <option value={NO_SURVEY_RESULT}>{NO_SURVEY_RESULT}</option>
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
            <JerusalemMap businesses={filtered} canEdit={canEdit} fixKey={fixKey} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
