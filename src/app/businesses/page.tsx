'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache, clearCache } from '@/lib/cache'

const BADGE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#b91c1c' },
  'בינוני':      { background: '#fff7ed', color: '#c2410c' },
  'לא חשוד':    { background: '#f0fdf4', color: '#15803d' },
  'דרוש בדיקה': { background: 'var(--cloud)', color: 'var(--charcoal)' },
}

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']

export default function BusinessesPage() {
  const ready = useRequireAuth()
  const [businesses,   setBusinesses]   = useState<Business[]>([])
  const [search,       setSearch]       = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter,   setTypeFilter]   = useState('הכל')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

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

  const filtered = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const ms = !q || [b.name, b.address, b.type, b.propertyOwners ?? ''].some(s => s.toLowerCase().includes(q))
    return ms && (ratingFilter === 'הכל' || b.suspicionRating === ratingFilter)
              && (typeFilter   === 'הכל' || b.type === typeFilter)
  }), [businesses, search, ratingFilter, typeFilter])

  function exportToExcel() {
    const rows = filtered.map(b => ({
      'שם העסק':        b.name,
      'סוג עסק':        b.type,
      'כתובת':          b.address,
      'כתובת תואמת':    b.matchedAddress,
      'דירוג אינדיקציה': b.suspicionRating,
      'פירוט האינדיקציה': b.suspicionDetail,
      'סיבת אי-אינדיקציה': b.noSuspicionReason,
      'מספר יחידות':   b.unitCount,
      'בעלי נכסים':    b.propertyOwners,
      'קישור 1':       b.link1,
      'קישור 2':       b.link2,
      'קישור 3':       b.link3,
      'תאריך העלאה':   b.uploadDate,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'נתונים')
    XLSX.writeFile(wb, 'נתוני_עסקים.xlsx')
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
  }

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>מאגר עסקים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>כלל הנתונים</h1>
      </section>

      <section style={{ background: 'var(--cloud)', padding: '20px 48px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="חיפוש לפי שם, כתובת, סוג עסק..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={inputStyle}>
          <option value="הכל">כל הדירוגים</option>
          {ALL_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
          <option value="הכל">כל סוגי העסק</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || ratingFilter !== 'הכל' || typeFilter !== 'הכל') && (
          <button onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל') }} style={btnOutlineInk}>
            נקה סינון
          </button>
        )}
        <span style={{ marginRight: 'auto', fontSize: 13, color: 'var(--graphite)', whiteSpace: 'nowrap' }}>
          {filtered.length} מתוך {businesses.length} עסקים
        </span>
        <button onClick={exportToExcel} style={btnExport} title={`ייצוא ${filtered.length} עסקים לאקסל`}>
          ייצוא לאקסל ↓
        </button>
      </section>

      <section style={{ background: 'var(--canvas)', padding: '32px 48px 80px' }}>
        {businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 32, fontWeight: 500, marginBottom: 16 }}>אין עסקים במערכת</p>
            <Link href="/upload" style={btnBlue}>העלאת דוח ראשון</Link>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                  {['', 'שם העסק', 'סוג עסק', 'כתובת', 'דירוג אינדיקציה', 'יחידות', 'תאריך', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--graphite)' }}>לא נמצאו תוצאות</td></tr>
                ) : filtered.map(b => (
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
                      <td style={{ padding: '14px 16px' }}>
                        {b.suspicionRating ? (
                          <span style={{ ...badge, ...(BADGE[b.suspicionRating] ?? { background: 'var(--cloud)', color: 'var(--charcoal)' }) }}>
                            {b.suspicionRating}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--graphite)' }}>{b.unitCount || '—'}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--graphite)', fontSize: 12 }}>{b.uploadDate}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <button onClick={e => { e.stopPropagation(); deleteBusiness(b.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 18, lineHeight: 1 }}>
                          ×
                        </button>
                      </td>
                    </tr>

                    {expanded === b.id && (
                      <tr key={`${b.id}-d`} style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                        <td colSpan={8} style={{ padding: '20px 48px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 48px', fontSize: 14 }}>
                            {[
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
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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
const btnOutlineInk: React.CSSProperties = { height: 44, padding: '0 16px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnExport: React.CSSProperties = { height: 44, padding: '0 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', whiteSpace: 'nowrap' }
