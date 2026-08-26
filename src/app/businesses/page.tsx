'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business } from '@/lib/types'
import { mapSuspicionRatingToStatus } from '@/lib/types'
import { supabase, dbToBusiness, businessToDb } from '@/lib/supabase'
import { getCache, setCache, clearCache } from '@/lib/cache'
import { formatDate } from '@/lib/dateUtils'

const BADGE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#b91c1c' },
  'בינוני':      { background: '#fff7ed', color: '#c2410c' },
  'לא חשוד':    { background: '#f0fdf4', color: '#15803d' },
  'דרוש בדיקה': { background: 'var(--cloud)', color: 'var(--charcoal)' },
}

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']

const INSPECTOR_STATUS: Record<string, React.CSSProperties> = {
  'נשלח לסוקר':              { background: '#f0fdf4', color: '#15803d' },
  'לא נשלח לסוקר':           { background: '#fef2f2', color: '#b91c1c' },
  'הוחלט לא לשלוח לסקר':     { background: '#fff7ed', color: '#c2410c' },
}

const SURVEY_RESULT_OPTIONS = ['נמצא פער בסיווג', 'נמצא פער שטח + סיווג', 'נמצא פער שטח', 'לא נמצא עסק/פער שטח']

const INSPECTOR_STATUS_OPTIONS = ['נשלח לסוקר', 'לא נשלח לסוקר', 'הוחלט לא לשלוח לסקר']

const SURVEY_RESULT_STATUS: Record<string, React.CSSProperties> = {
  '':                          { background: 'var(--cloud)', color: 'var(--charcoal)' },
  'נמצא פער בסיווג':          { background: '#fff7ed', color: '#c2410c' },
  'נמצא פער שטח + סיווג':     { background: '#fef2f2', color: '#b91c1c' },
  'נמצא פער שטח':             { background: '#fefce8', color: '#a16207' },
  'לא נמצא עסק/פער שטח':      { background: '#f0fdf4', color: '#15803d' },
}

function linkCount(b: Business): number {
  return [b.link1, b.link2, b.link3].filter(Boolean).length
}

type SortKey = 'name' | 'type' | 'address' | 'neighborhood' | 'suspicionRating' | 'unitCount' | 'linksCount' | 'uploadDate' | 'sentToInspector' | 'surveyResultDetail'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey | null, label: string, accessor?: (b: Business) => string | number }[] = [
  { key: null, label: '' },
  { key: 'name', label: 'שם העסק', accessor: b => b.name },
  { key: 'type', label: 'סוג עסק', accessor: b => b.type },
  { key: 'address', label: 'כתובת', accessor: b => b.address },
  { key: 'neighborhood', label: 'שכונה', accessor: b => b.neighborhood },
  { key: 'linksCount', label: 'קישורים', accessor: b => linkCount(b) },
  { key: 'suspicionRating', label: 'דירוג אינדיקציה', accessor: b => ALL_RATINGS.indexOf(b.suspicionRating) },
  { key: 'unitCount', label: 'יחידות', accessor: b => parseFloat(b.unitCount) || 0 },
  { key: 'uploadDate', label: 'תאריך', accessor: b => b.uploadDate },
  { key: 'sentToInspector', label: 'סוקר', accessor: b => b.sentToInspector ?? '' },
  { key: 'surveyResultDetail', label: 'פירוט תוצאות הסקר', accessor: b => b.surveyResultDetail ?? '' },
  { key: null, label: '' },
]

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'he')
}

function EditField({ label, value, onChange, full }: { label: string, value: string, onChange: (v: string) => void, full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1/-1' } : {}}>
      <label style={editLabel}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={editInput} />
    </div>
  )
}

function EditTextArea({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div style={{ gridColumn: '1/-1' }}>
      <label style={editLabel}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} style={{ ...editInput, resize: 'vertical' as const }} />
    </div>
  )
}

export default function BusinessesPage() {
  const ready = useRequireAuth()
  const [businesses,   setBusinesses]   = useState<Business[]>([])
  const [search,       setSearch]       = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter,   setTypeFilter]   = useState('הכל')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('הכל')
  const [inspectorFilter, setInspectorFilter] = useState('הכל')
  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editForm,     setEditForm]     = useState<Partial<Business>>({})
  const [loading,      setLoading]      = useState(true)
  const [updating,     setUpdating]     = useState<string | null>(null)
  const [sortKey,      setSortKey]      = useState<SortKey | null>(null)
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) { setBusinesses(cached); setLoading(false) }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const types = useMemo(() =>
    [...new Set(businesses.map(b => b.type).filter(Boolean))].sort()
  , [businesses])

  const neighborhoods = useMemo(() =>
    [...new Set(businesses.map(b => b.neighborhood).filter(Boolean))].sort()
  , [businesses])

  const ratingsInUse = useMemo(() =>
    ALL_RATINGS.filter(r => businesses.some(b => b.suspicionRating === r))
  , [businesses])

  const filtered = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const ms = !q || [b.name, b.address, b.type, b.neighborhood ?? '', b.propertyOwners ?? ''].some(s => s.toLowerCase().includes(q))
    return ms && (ratingFilter === 'הכל' || b.suspicionRating === ratingFilter)
              && (typeFilter   === 'הכל' || b.type === typeFilter)
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function exportToExcel() {
    const rows = filtered.map(b => ({
      'שם העסק':        b.name,
      'סוג עסק':        b.type,
      'כתובת':          b.address,
      'שכונה':          b.neighborhood,
      'כתובת תואמת':    b.matchedAddress,
      'דירוג אינדיקציה': b.suspicionRating,
      'פירוט האינדיקציה': b.suspicionDetail,
      'סיבת אי-אינדיקציה': b.noSuspicionReason,
      'מספר יחידות':   b.unitCount,
      'בעלי נכסים':    b.propertyOwners,
      'קישור 1':       b.link1,
      'קישור 2':       b.link2,
      'קישור 3':       b.link3,
      'תאריך העלאה':   formatDate(b.uploadDate),
      'נשלח לסוקר':    b.sentToInspector ?? 'לא נשלח לסוקר',
      'פירוט תוצאות הסקר': b.surveyResultDetail ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'נתונים')
    XLSX.writeFile(wb, 'נתוני_עסקים.xlsx')
  }

  async function updateInspectorStatus(id: string, status: 'נשלח לסוקר' | 'לא נשלח לסוקר' | 'הוחלט לא לשלוח לסקר') {
    setUpdating(id)
    try {
      const business = businesses.find(b => b.id === id)
      if (!business) return
      const updated = { ...business, sentToInspector: status }
      await supabase.from('businesses').update(businessToDb(updated)).eq('id', id)
      setBusinesses(prev => {
        const next = prev.map(b => b.id === id ? updated : b)
        setCache('businesses', next)
        return next
      })
    } catch (error) {
      console.error('Error updating inspector status:', error)
    }
    setUpdating(null)
  }

  async function updateSurveyResult(id: string, value: string) {
    setUpdating(id)
    try {
      const business = businesses.find(b => b.id === id)
      if (!business) return
      const updated = { ...business, surveyResultDetail: (value || null) as Business['surveyResultDetail'] }
      await supabase.from('businesses').update(businessToDb(updated)).eq('id', id)
      setBusinesses(prev => {
        const next = prev.map(b => b.id === id ? updated : b)
        setCache('businesses', next)
        return next
      })
    } catch (error) {
      console.error('Error updating survey result:', error)
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
    if (!name || !address) {
      alert('שם העסק וכתובת הם שדות חובה')
      return
    }
    const original = businesses.find(b => b.id === editingId)
    if (!original) return

    const updated: Business = {
      ...original,
      ...editForm,
      name,
      address,
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
  if (loading) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>מאגר עסקים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>כלל הנתונים</h1>
      </section>

      <section style={{ background: 'var(--cloud)', padding: '20px 48px', borderBottom: filtersOpen ? 'none' : undefined }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="חיפוש לפי שם, כתובת, סוג עסק, שכונה..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button onClick={() => setFiltersOpen(o => !o)} style={{ ...btnOutlineInk, display: 'flex', alignItems: 'center', gap: 6 }}>
            בחר סננים{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: filtersOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          <span style={{ marginRight: 'auto', fontSize: 13, color: 'var(--graphite)', whiteSpace: 'nowrap' }}>
            {filtered.length} מתוך {businesses.length} עסקים
          </span>
          <button onClick={exportToExcel} style={btnExport} title={`ייצוא ${filtered.length} עסקים לאקסל`}>
            ייצוא לאקסל ↓
          </button>
        </div>

        {filtersOpen && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
            <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={inputStyle}>
              <option value="הכל">כל הדירוגים</option>
              {ratingsInUse.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
              <option value="הכל">כל סוגי העסק</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={neighborhoodFilter} onChange={e => setNeighborhoodFilter(e.target.value)} style={inputStyle}>
              <option value="הכל">כל השכונות</option>
              {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={inspectorFilter} onChange={e => setInspectorFilter(e.target.value)} style={inputStyle}>
              <option value="הכל">כל סטטוסי הסוקר</option>
              {INSPECTOR_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(search || activeFilterCount > 0) && (
              <button onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל'); setNeighborhoodFilter('הכל'); setInspectorFilter('הכל') }} style={btnOutlineInk}>
                נקה סינון
              </button>
            )}
          </div>
        )}
      </section>

      <section style={{ background: 'var(--canvas)', padding: '32px 48px 80px' }}>
        {businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 32, fontWeight: 500, marginBottom: 16 }}>אין עסקים במערכת</p>
            <Link href="/upload" style={btnBlue}>העלאת דוח ראשון</Link>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                  {COLUMNS.map((c, i) => (
                    <th
                      key={i}
                      onClick={c.key ? () => toggleSort(c.key as SortKey) : undefined}
                      style={{
                        textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)',
                        textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
                        cursor: c.key ? 'pointer' : 'default', userSelect: 'none',
                      }}
                    >
                      {c.label}{sortKey === c.key && c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--graphite)' }}>לא נמצאו תוצאות</td></tr>
                ) : sorted.map(b => (
                  <>
                    <tr
                      key={b.id}
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--hairline)', background: expanded === b.id ? 'var(--cloud)' : 'var(--canvas)' }}
                    >
                      <td style={{ padding: '14px 12px 14px 16px', color: 'var(--steel)', fontSize: 10, width: 28 }}>{expanded === b.id ? '▾' : '▸'}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--ink)' }}>{b.name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--charcoal)' }}>{b.type}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--charcoal)' }}>{b.address}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--charcoal)' }}>{b.neighborhood || '—'}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--graphite)' }}>{linkCount(b)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {b.suspicionRating ? (
                          <span style={{ ...badge, ...(BADGE[b.suspicionRating] ?? { background: 'var(--cloud)', color: 'var(--charcoal)' }) }}>
                            {b.suspicionRating}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--graphite)' }}>{b.unitCount || '—'}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--graphite)', fontSize: 12 }}>{formatDate(b.uploadDate)}</td>
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={b.sentToInspector ?? 'לא נשלח לסוקר'}
                          onChange={e => updateInspectorStatus(b.id, e.target.value as 'נשלח לסוקר' | 'לא נשלח לסוקר' | 'הוחלט לא לשלוח לסקר')}
                          disabled={updating === b.id}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--hairline)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: updating === b.id ? 'wait' : 'pointer',
                            ...(INSPECTOR_STATUS[b.sentToInspector ?? 'לא נשלח לסוקר'] ?? INSPECTOR_STATUS['לא נשלח לסוקר']),
                          }}
                        >
                          <option value='נשלח לסוקר'>נשלח לסוקר</option>
                          <option value='לא נשלח לסוקר'>לא נשלח לסוקר</option>
                          <option value='הוחלט לא לשלוח לסקר'>הוחלט לא לשלוח לסקר</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        <select
                          value={b.surveyResultDetail ?? ''}
                          onChange={e => updateSurveyResult(b.id, e.target.value)}
                          disabled={updating === b.id}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--hairline)',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: updating === b.id ? 'wait' : 'pointer',
                            ...(SURVEY_RESULT_STATUS[b.surveyResultDetail ?? ''] ?? SURVEY_RESULT_STATUS['']),
                          }}
                        >
                          <option value=''>—</option>
                          {SURVEY_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <button onClick={e => { e.stopPropagation(); startEdit(b) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 14, lineHeight: 1, marginLeft: 10 }}
                          title="ערוך">
                          ✎
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteBusiness(b.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 18, lineHeight: 1 }}
                          title="מחק">
                          ×
                        </button>
                      </td>
                    </tr>

                    {expanded === b.id && (
                      <tr key={`${b.id}-d`} style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                        <td colSpan={12} style={{ padding: '20px 48px' }}>
                          {editingId === b.id ? (
                            <div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 48px', fontSize: 14 }}>
                                <EditField label="שם העסק"      value={editForm.name ?? ''}      onChange={v => setEditForm(f => ({ ...f, name: v }))} />
                                <EditField label="סוג עסק"      value={editForm.type ?? ''}      onChange={v => setEditForm(f => ({ ...f, type: v }))} />
                                <EditField label="כתובת"        value={editForm.address ?? ''}   onChange={v => setEditForm(f => ({ ...f, address: v }))} />
                                <EditField label="שכונה"        value={editForm.neighborhood ?? ''} onChange={v => setEditForm(f => ({ ...f, neighborhood: v }))} />
                                <EditField label="כתובת תואמת"  value={editForm.matchedAddress ?? ''} onChange={v => setEditForm(f => ({ ...f, matchedAddress: v }))} />
                                <EditField label="מספר יחידות"  value={editForm.unitCount ?? ''} onChange={v => setEditForm(f => ({ ...f, unitCount: v }))} />
                                <div>
                                  <label style={editLabel}>דירוג אינדיקציה</label>
                                  <select
                                    value={editForm.suspicionRating ?? ''}
                                    onChange={e => setEditForm(f => ({ ...f, suspicionRating: e.target.value }))}
                                    style={editInput}
                                  >
                                    <option value="">—</option>
                                    {ALL_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                </div>
                                <EditField label="קישור 1" value={editForm.link1 ?? ''} onChange={v => setEditForm(f => ({ ...f, link1: v }))} />
                                <EditField label="קישור 2" value={editForm.link2 ?? ''} onChange={v => setEditForm(f => ({ ...f, link2: v }))} />
                                <EditField label="קישור 3" value={editForm.link3 ?? ''} onChange={v => setEditForm(f => ({ ...f, link3: v }))} />
                                <EditTextArea label="בעלי נכסים"      value={editForm.propertyOwners ?? ''}    onChange={v => setEditForm(f => ({ ...f, propertyOwners: v }))} />
                                <EditTextArea label="פירוט האינדיקציה" value={editForm.suspicionDetail ?? ''}   onChange={v => setEditForm(f => ({ ...f, suspicionDetail: v }))} />
                                <EditTextArea label="סיבת אי-אינדיקציה" value={editForm.noSuspicionReason ?? ''} onChange={v => setEditForm(f => ({ ...f, noSuspicionReason: v }))} />
                              </div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button onClick={saveEdit} style={btnBlue2}>שמור</button>
                                <button onClick={cancelEdit} style={btnOutlineInk}>ביטול</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 48px', fontSize: 14 }}>
                              {[
                                b.neighborhood       && ['שכונה', b.neighborhood],
                                b.matchedAddress    && ['כתובת תואמת', b.matchedAddress],
                                b.unitCount         && ['מספר יחידות', b.unitCount],
                                b.suspicionDetail   && ['פירוט האינדיקציה', b.suspicionDetail],
                                b.noSuspicionReason && ['סיבת אי-אינדיקציה', b.noSuspicionReason],
                                b.propertyOwners    && ['בעלי נכסים', b.propertyOwners],
                              ].filter(Boolean).map(pair => {
                                const [label, value] = pair as [string, string]
                                const full = ['פירוט האינדיקציה','סיבת אי-אינדיקציה','בעלי נכסים'].includes(label)
                                return (
                                  <div key={label} style={full ? { gridColumn: '1/-1' } : {}}>
                                    <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{label}: </span>
                                    <span style={{ color: 'var(--ink)' }}>{value}</span>
                                  </div>
                                )
                              })}
                              {[b.link1, b.link2, b.link3].filter(Boolean).length > 0 && (
                                <div style={{ gridColumn: '1/-1' }}>
                                  {b.link1 && (
                                    <div style={{ marginBottom: 8 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>קישור 1: </span>
                                      <a href={b.link1} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hp-blue)', textDecoration: 'none', wordBreak: 'break-all' }}>
                                        {b.link1}
                                      </a>
                                    </div>
                                  )}
                                  {b.link2 && (
                                    <div style={{ marginBottom: 8 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>קישור 2: </span>
                                      <a href={b.link2} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hp-blue)', textDecoration: 'none', wordBreak: 'break-all' }}>
                                        {b.link2}
                                      </a>
                                    </div>
                                  )}
                                  {b.link3 && (
                                    <div>
                                      <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>קישור 3: </span>
                                      <a href={b.link3} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hp-blue)', textDecoration: 'none', wordBreak: 'break-all' }}>
                                        {b.link3}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div style={{ gridColumn: '1/-1' }}>
                                <button onClick={() => startEdit(b)} style={btnOutlineInk}>ערוך פרטי עסק</button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            </div>
            <div style={{ padding: '12px 24px', background: 'var(--cloud)', borderTop: '1px solid var(--hairline)', fontSize: 13, color: 'var(--graphite)' }}>
              מציג {filtered.length} מתוך {businesses.length} עסקים
            </div>
          </div>
        )}
      </section>
    </AppLayout>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--fog)', borderTopColor: 'var(--hp-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }
const badge:   React.CSSProperties = { borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }
const inputStyle: React.CSSProperties = { height: 44, padding: '0 14px', border: '1px solid var(--steel)', borderRadius: 4, fontSize: 14, color: 'var(--ink)', background: 'var(--canvas)', outline: 'none' }
const btnBlue: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--hp-blue)', color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none' }
const btnBlue2: React.CSSProperties = { height: 40, padding: '0 20px', background: 'var(--hp-blue)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnOutlineInk: React.CSSProperties = { height: 44, padding: '0 16px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnExport: React.CSSProperties = { height: 44, padding: '0 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', whiteSpace: 'nowrap' }
const editLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }
const editInput: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--steel)', borderRadius: 4, fontSize: 14, color: 'var(--ink)', background: 'var(--canvas)', outline: 'none', boxSizing: 'border-box' as const }
