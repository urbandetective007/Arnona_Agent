'use client'

import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Search, SlidersHorizontal, X, Download, Send, ChevronDown, ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { mapSuspicionRatingToStatus } from '@/lib/types'
import { supabase, dbToBusiness, businessToDb } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { formatDate } from '@/lib/dateUtils'
import { Card, Button, Badge, Input, Select, Spinner, EmptyState } from '@/components/ui'
import type { BadgeTone } from '@/components/ui'

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']
const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid', 'לא חשוד': 'clear' }
const INSPECTOR_OPTIONS = ['נשלח לסוקר', 'לא נשלח לסוקר', 'הוחלט לא לשלוח לסקר'] as const
const SURVEY_RESULT_OPTIONS = ['נמצא פער בסיווג', 'נמצא פער שטח + סיווג', 'נמצא פער שטח', 'לא נמצא עסק/פער שטח']

function linkCount(b: Business): number {
  return [b.link1, b.link2, b.link3].filter(Boolean).length
}

type SortKey = 'name' | 'type' | 'address' | 'neighborhood' | 'suspicionRating' | 'unitCount' | 'linksCount' | 'uploadDate' | 'sentToInspector' | 'surveyResultDetail'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey | null; label: string; accessor?: (b: Business) => string | number }[] = [
  { key: 'name', label: 'שם העסק', accessor: b => b.name },
  { key: 'type', label: 'סוג עסק', accessor: b => b.type },
  { key: 'address', label: 'כתובת', accessor: b => b.address },
  { key: 'neighborhood', label: 'שכונה', accessor: b => b.neighborhood },
  { key: 'linksCount', label: 'קישורים', accessor: b => linkCount(b) },
  { key: 'suspicionRating', label: 'דירוג אינדיקציה', accessor: b => ALL_RATINGS.indexOf(b.suspicionRating) },
  { key: 'unitCount', label: 'יחידות', accessor: b => parseFloat(b.unitCount) || 0 },
  { key: 'uploadDate', label: 'תאריך', accessor: b => b.uploadDate },
  { key: 'sentToInspector', label: 'סוקר', accessor: b => b.sentToInspector ?? '' },
  { key: 'surveyResultDetail', label: 'תוצאת סקר', accessor: b => b.surveyResultDetail ?? '' },
]

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'he')
}

function EditField({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-[12px] font-semibold text-charcoal mb-1">{label}</label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="w-full" />
    </div>
  )
}

function EditTextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="col-span-2">
      <label className="block text-[12px] font-semibold text-charcoal mb-1">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full p-2.5 rounded-lg border border-hairline bg-surface text-[13.5px] text-ink outline-none focus:border-brand resize-y"
      />
    </div>
  )
}

export default function BusinessesPage() {
  const ready = useRequireRole(['employee'])
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
  const [inspectorFilter, setInspectorFilter] = useState('הכל')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Business>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
      && (inspectorFilter === 'הכל' || (b.sentToInspector ?? 'לא נשלח לסוקר') === inspectorFilter)
  }), [businesses, search, ratingFilter, typeFilter, neighborhoodFilter, inspectorFilter])

  const activeFilterCount = [ratingFilter, typeFilter, neighborhoodFilter, inspectorFilter].filter(f => f !== 'הכל').length

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = COLUMNS.find(c => c.key === sortKey)
    if (!col?.accessor) return filtered
    const accessor = col.accessor
    const result = [...filtered].sort((a, b) => compareValues(accessor(a), accessor(b)))
    if (sortDir === 'desc') result.reverse()
    return result
  }, [filtered, sortKey, sortDir])

  // Selections that have scrolled out of the current filter stay selected in
  // state but shouldn't count toward the visible "X נבחרו" toolbar.
  const visibleSelectedIds = useMemo(() => sorted.filter(b => selectedIds.has(b.id)).map(b => b.id), [sorted, selectedIds])
  const allVisibleSelected = sorted.length > 0 && visibleSelectedIds.length === sorted.length

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) sorted.forEach(b => next.delete(b.id))
      else sorted.forEach(b => next.add(b.id))
      return next
    })
  }

  async function bulkSendToInspector() {
    const ids = visibleSelectedIds
    if (ids.length === 0) return
    setBulkUpdating(true)
    const { error } = await supabase.from('businesses').update({ sent_to_inspector: 'נשלח לסוקר' }).in('id', ids)
    if (!error) {
      setBusinesses(prev => {
        const next = prev.map(b => ids.includes(b.id) ? { ...b, sentToInspector: 'נשלח לסוקר' as const } : b)
        setCache('businesses', next)
        return next
      })
      setSelectedIds(new Set())
    } else {
      alert(`שגיאה בשליחה לסוקר: ${error.message}`)
    }
    setBulkUpdating(false)
  }

  function exportToExcel() {
    const rows = filtered.map(b => ({
      'שם העסק': b.name, 'סוג עסק': b.type, 'כתובת': b.address, 'שכונה': b.neighborhood,
      'כתובת תואמת': b.matchedAddress, 'דירוג אינדיקציה': b.suspicionRating, 'פירוט האינדיקציה': b.suspicionDetail,
      'סיבת אי-אינדיקציה': b.noSuspicionReason, 'מספר יחידות': b.unitCount, 'בעלי נכסים': b.propertyOwners,
      'קישור 1': b.link1, 'קישור 2': b.link2, 'קישור 3': b.link3, 'תאריך העלאה': formatDate(b.uploadDate),
      'נשלח לסוקר': b.sentToInspector ?? 'לא נשלח לסוקר', 'תוצאת סקר': b.surveyResultDetail ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'נתונים')
    XLSX.writeFile(wb, 'נתוני_עסקים.xlsx')
  }

  async function updateInspectorStatus(id: string, status: typeof INSPECTOR_OPTIONS[number]) {
    setUpdating(id)
    const business = businesses.find(b => b.id === id)
    if (business) {
      const updated = { ...business, sentToInspector: status }
      const { error } = await supabase.from('businesses').update(businessToDb(updated)).eq('id', id)
      if (!error) {
        setBusinesses(prev => {
          const next = prev.map(b => b.id === id ? updated : b)
          setCache('businesses', next)
          return next
        })
      }
    }
    setUpdating(null)
  }

  async function updateSurveyResult(id: string, value: string) {
    setUpdating(id)
    const business = businesses.find(b => b.id === id)
    if (business) {
      const updated = { ...business, surveyResultDetail: (value || null) as Business['surveyResultDetail'] }
      const { error } = await supabase.from('businesses').update(businessToDb(updated)).eq('id', id)
      if (!error) {
        setBusinesses(prev => {
          const next = prev.map(b => b.id === id ? updated : b)
          setCache('businesses', next)
          return next
        })
      }
    }
    setUpdating(null)
  }

  async function deleteBusiness(id: string) {
    if (!confirm('למחוק עסק זה?')) return
    await supabase.from('businesses').delete().eq('id', id)
    setBusinesses(prev => {
      const next = prev.filter(b => b.id !== id)
      setCache('businesses', next)
      return next
    })
    if (expanded === id) setExpanded(null)
    if (editingId === id) { setEditingId(null); setEditForm({}) }
  }

  function startEdit(b: Business) {
    setEditForm({ ...b })
    setEditingId(b.id)
    setExpanded(b.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }

  async function saveEdit() {
    if (!editingId) return
    const name = (editForm.name ?? '').trim()
    const address = (editForm.address ?? '').trim()
    if (!name || !address) { alert('שם העסק וכתובת הם שדות חובה'); return }
    const original = businesses.find(b => b.id === editingId)
    if (!original) return

    const updated: Business = {
      ...original, ...editForm, name, address,
      arnonaStatus: mapSuspicionRatingToStatus(editForm.suspicionRating ?? original.suspicionRating),
    }
    const { error } = await supabase.from('businesses').update(businessToDb(updated)).eq('id', editingId)
    if (error) { alert(`שגיאה בשמירה: ${error.message}`); return }

    setBusinesses(prev => {
      const next = prev.map(b => b.id === editingId ? updated : b)
      setCache('businesses', next)
      return next
    })
    setEditingId(null)
    setEditForm({})
  }

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="כלל הנתונים">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  return (
    <AppShell title="כלל הנתונים" subtitle={`${filtered.length.toLocaleString('he')} מתוך ${businesses.length.toLocaleString('he')} עסקים`}>
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-subtle pointer-events-none" strokeWidth={1.9} />
              <Input
                type="text"
                placeholder="חיפוש לפי שם, כתובת, סוג עסק, שכונה..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full ps-9"
              />
            </div>
            <Button variant="secondary" icon={<SlidersHorizontal size={15} strokeWidth={1.9} />} onClick={() => setFiltersOpen(o => !o)}>
              סננים{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            {(search || activeFilterCount > 0) && (
              <Button
                variant="ghost"
                icon={<X size={15} strokeWidth={1.9} />}
                onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל'); setNeighborhoodFilter('הכל'); setInspectorFilter('הכל') }}
              >
                נקה סינון
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Download size={15} strokeWidth={1.9} />}
              onClick={exportToExcel}
              className="ms-auto"
            >
              ייצוא לאקסל
            </Button>
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
              <Select value={inspectorFilter} onChange={e => setInspectorFilter(e.target.value)}>
                <option value="הכל">כל סטטוסי הסוקר</option>
                {INSPECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          )}
        </Card>

        {visibleSelectedIds.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-brand/[0.06] border border-brand/25 rounded-xl flex-wrap">
            <span className="text-[13px] font-semibold text-ink"><span className="num">{visibleSelectedIds.length}</span> נבחרו</span>
            <Button
              variant="primary"
              icon={<Send size={14} strokeWidth={1.9} />}
              onClick={bulkSendToInspector}
              disabled={bulkUpdating}
              className="h-9"
            >
              {bulkUpdating ? 'שולח...' : 'שלח לסוקר'}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-9">בטל בחירה</Button>
          </div>
        )}

        {businesses.length === 0 ? (
          <Card>
            <EmptyState title="אין עסקים במערכת" action={<Button href="/upload">העלאת דוח ראשון</Button>} />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px] min-w-[1000px]">
                <thead>
                  <tr className="bg-canvas border-b border-hairline">
                    <th className="px-3.5 py-2.5 w-9">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="w-4 h-4 accent-[#024ad8] cursor-pointer" />
                    </th>
                    <th className="w-6" />
                    {COLUMNS.map(c => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key as SortKey)}
                        className="px-3.5 py-2.5 text-start text-[12px] font-semibold text-graphite whitespace-nowrap cursor-pointer select-none"
                      >
                        {c.label}{sortKey === c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                    ))}
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {sorted.length === 0 ? (
                    <tr><td colSpan={13} className="text-center py-12 text-graphite">לא נמצאו תוצאות</td></tr>
                  ) : sorted.map(b => (
                    <RowGroup key={b.id}>
                      <tr
                        className={`cursor-pointer transition-colors ${expanded === b.id ? 'bg-canvas' : 'hover:bg-canvas/60'}`}
                        onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      >
                        <td className="px-3.5 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(b.id)} onChange={() => toggleSelected(b.id)} className="w-4 h-4 accent-[#024ad8] cursor-pointer" />
                        </td>
                        <td className="text-subtle">{expanded === b.id ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}</td>
                        <td className="px-3.5 py-3 font-semibold text-ink">{b.name}</td>
                        <td className="px-3.5 py-3 text-charcoal">{b.type}</td>
                        <td className="px-3.5 py-3 text-charcoal">{b.address}</td>
                        <td className="px-3.5 py-3 text-charcoal">{b.neighborhood || '—'}</td>
                        <td className="px-3.5 py-3 text-graphite">{linkCount(b)}</td>
                        <td className="px-3.5 py-3">
                          {b.suspicionRating ? <Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'}>{b.suspicionRating}</Badge> : '—'}
                        </td>
                        <td className="px-3.5 py-3 text-graphite">{b.unitCount || '—'}</td>
                        <td className="px-3.5 py-3 text-graphite text-[12px]">{formatDate(b.uploadDate)}</td>
                        <td className="px-3.5 py-3" onClick={e => e.stopPropagation()}>
                          <Select
                            value={b.sentToInspector ?? 'לא נשלח לסוקר'}
                            onChange={e => updateInspectorStatus(b.id, e.target.value as typeof INSPECTOR_OPTIONS[number])}
                            disabled={updating === b.id}
                            className="h-9 text-[12.5px] px-2.5"
                          >
                            {INSPECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </td>
                        <td className="px-3.5 py-3" onClick={e => e.stopPropagation()}>
                          <Select
                            value={b.surveyResultDetail ?? ''}
                            onChange={e => updateSurveyResult(b.id, e.target.value)}
                            disabled={updating === b.id}
                            className="h-9 text-[12.5px] px-2.5"
                          >
                            <option value="">—</option>
                            {SURVEY_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </Select>
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <button onClick={e => { e.stopPropagation(); startEdit(b) }} className="text-subtle hover:text-brand me-2.5" title="ערוך">
                            <Pencil size={15} strokeWidth={1.8} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteBusiness(b.id) }} className="text-subtle hover:text-high" title="מחק">
                            <Trash2 size={15} strokeWidth={1.8} />
                          </button>
                        </td>
                      </tr>

                      {expanded === b.id && (
                        <tr className="bg-canvas">
                          <td colSpan={13} className="px-8 py-5">
                            {editingId === b.id ? (
                              <div>
                                <div className="grid grid-cols-2 gap-x-10 gap-y-3">
                                  <EditField label="שם העסק" value={editForm.name ?? ''} onChange={v => setEditForm(f => ({ ...f, name: v }))} />
                                  <EditField label="סוג עסק" value={editForm.type ?? ''} onChange={v => setEditForm(f => ({ ...f, type: v }))} />
                                  <EditField label="כתובת" value={editForm.address ?? ''} onChange={v => setEditForm(f => ({ ...f, address: v }))} />
                                  <EditField label="שכונה" value={editForm.neighborhood ?? ''} onChange={v => setEditForm(f => ({ ...f, neighborhood: v }))} />
                                  <EditField label="כתובת תואמת" value={editForm.matchedAddress ?? ''} onChange={v => setEditForm(f => ({ ...f, matchedAddress: v }))} />
                                  <EditField label="מספר יחידות" value={editForm.unitCount ?? ''} onChange={v => setEditForm(f => ({ ...f, unitCount: v }))} />
                                  <div>
                                    <label className="block text-[12px] font-semibold text-charcoal mb-1">דירוג אינדיקציה</label>
                                    <Select value={editForm.suspicionRating || 'דרוש בדיקה'} onChange={e => setEditForm(f => ({ ...f, suspicionRating: e.target.value }))} className="w-full">
                                      {ALL_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </Select>
                                  </div>
                                  <EditField label="קישור 1" value={editForm.link1 ?? ''} onChange={v => setEditForm(f => ({ ...f, link1: v }))} />
                                  <EditField label="קישור 2" value={editForm.link2 ?? ''} onChange={v => setEditForm(f => ({ ...f, link2: v }))} />
                                  <EditField label="קישור 3" value={editForm.link3 ?? ''} onChange={v => setEditForm(f => ({ ...f, link3: v }))} />
                                  <EditTextArea label="בעלי נכסים" value={editForm.propertyOwners ?? ''} onChange={v => setEditForm(f => ({ ...f, propertyOwners: v }))} />
                                  <EditTextArea label="פירוט האינדיקציה" value={editForm.suspicionDetail ?? ''} onChange={v => setEditForm(f => ({ ...f, suspicionDetail: v }))} />
                                  <EditTextArea label="סיבת אי-אינדיקציה" value={editForm.noSuspicionReason ?? ''} onChange={v => setEditForm(f => ({ ...f, noSuspicionReason: v }))} />
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <Button onClick={saveEdit}>שמור</Button>
                                  <Button variant="secondary" onClick={cancelEdit}>ביטול</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-[13.5px]">
                                {([
                                  b.neighborhood && ['שכונה', b.neighborhood],
                                  b.matchedAddress && ['כתובת תואמת', b.matchedAddress],
                                  b.unitCount && ['מספר יחידות', b.unitCount],
                                  b.suspicionDetail && ['פירוט האינדיקציה', b.suspicionDetail],
                                  b.noSuspicionReason && ['סיבת אי-אינדיקציה', b.noSuspicionReason],
                                  b.propertyOwners && ['בעלי נכסים', b.propertyOwners],
                                ].filter(Boolean) as [string, string][]).map(([label, value]) => {
                                  const full = ['פירוט האינדיקציה', 'סיבת אי-אינדיקציה', 'בעלי נכסים'].includes(label)
                                  return (
                                    <div key={label} className={full ? 'col-span-2' : ''}>
                                      <span className="font-semibold text-charcoal">{label}: </span>
                                      <span className="text-ink">{value}</span>
                                    </div>
                                  )
                                })}
                                {[b.link1, b.link2, b.link3].filter(Boolean).length > 0 && (
                                  <div className="col-span-2 flex flex-col gap-2">
                                    {[b.link1, b.link2, b.link3].filter(Boolean).map((link, i) => (
                                      <div key={i}>
                                        <span className="font-semibold text-charcoal">קישור {i + 1}: </span>
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-deep break-all">{link}</a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <Button variant="secondary" onClick={() => startEdit(b)}>ערוך פרטי עסק</Button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-canvas border-t border-hairline text-[13px] text-graphite">
              מציג {filtered.length.toLocaleString('he')} מתוך {businesses.length.toLocaleString('he')} עסקים
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}

// A tiny fragment-with-key helper — React.Fragment can't take an arbitrary
// key via JSX shorthand when generated inside .map without this, and the
// `<>` shorthand doesn't accept a key prop at all.
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
