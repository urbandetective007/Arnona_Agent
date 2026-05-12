'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'

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

  useEffect(() => {
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) setBusinesses(data.map(dbToBusiness))
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

  async function deleteBusiness(id: string) {
    if (!confirm('למחוק עסק זה?')) return
    await supabase.from('businesses').delete().eq('id', id)
    setBusinesses(prev => prev.filter(b => b.id !== id))
    if (expanded === id) setExpanded(null)
  }

  if (!ready) return null

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
      </section>

      <section style={{ background: 'var(--canvas)', padding: '32px 48px 80px' }}>
        {businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: 32, fontWeight: 500, marginBottom: 16 }}>אין עסקים במערכת</p>
            <a href="/upload" style={btnBlue}>העלאת דוח ראשון</a>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                  {['', 'שם העסק', 'סוג עסק', 'כתובת', 'דירוג חשד', 'יחידות', 'תאריך', ''].map((h, i) => (
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
                              b.suspicionDetail   && ['פירוט החשד', b.suspicionDetail],
                              b.noSuspicionReason && ['סיבת אי-חשד', b.noSuspicionReason],
                              b.propertyOwners    && ['בעלי נכסים', b.propertyOwners],
                            ].filter(Boolean).map(pair => {
                              const [label, value] = pair as [string, string]
                              const full = ['פירוט החשד','סיבת אי-חשד','בעלי נכסים'].includes(label)
                              return (
                                <div key={label} style={full ? { gridColumn: '1/-1' } : {}}>
                                  <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{label}: </span>
                                  <span style={{ color: 'var(--ink)' }}>{value}</span>
                                </div>
                              )
                            })}
                            {b.link && (
                              <div style={{ gridColumn: '1/-1' }}>
                                <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>קישור: </span>
                                <a href={b.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hp-blue)', textDecoration: 'none' }}>{b.link}</a>
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

const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }
const badge:   React.CSSProperties = { borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }
const inputStyle: React.CSSProperties = { height: 44, padding: '0 14px', border: '1px solid var(--steel)', borderRadius: 4, fontSize: 14, color: 'var(--ink)', background: 'var(--canvas)', outline: 'none' }
const btnBlue: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--hp-blue)', color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none' }
const btnOutlineInk: React.CSSProperties = { height: 44, padding: '0 16px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
