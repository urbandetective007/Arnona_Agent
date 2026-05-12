'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business } from '@/lib/types'

const RATING_STYLE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#991b1b', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 500, display: 'inline-block' },
  'בינוני':      { background: '#fff7ed', color: '#9a3412', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 500, display: 'inline-block' },
  'לא חשוד':    { background: '#f0fdf4', color: '#166534', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 500, display: 'inline-block' },
  'דרוש בדיקה': { background: '#fefce8', color: '#854d0e', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 500, display: 'inline-block' },
}

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']

export default function BusinessesPage() {
  const ready = useRequireAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search,      setSearch]     = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter,  setTypeFilter]  = useState('הכל')
  const [expanded,    setExpanded]    = useState<string | null>(null)

  useEffect(() => {
    const b = localStorage.getItem('businesses')
    if (b) setBusinesses(JSON.parse(b))
  }, [])

  const businessTypes = useMemo(() =>
    [...new Set(businesses.map(b => b.type).filter(Boolean))].sort()
  , [businesses])

  const filtered = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.name.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      (b.propertyOwners || '').toLowerCase().includes(q)
    const matchRating = ratingFilter === 'הכל' || b.suspicionRating === ratingFilter
    const matchType   = typeFilter   === 'הכל' || b.type === typeFilter
    return matchSearch && matchRating && matchType
  }), [businesses, search, ratingFilter, typeFilter])

  function deleteBusiness(id: string) {
    if (!confirm('למחוק עסק זה?')) return
    const updated = businesses.filter(b => b.id !== id)
    setBusinesses(updated)
    localStorage.setItem('businesses', JSON.stringify(updated))
    if (expanded === id) setExpanded(null)
  }

  if (!ready) return null

  const hasFilter = search || ratingFilter !== 'הכל' || typeFilter !== 'הכל'

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ padding: '48px 48px 32px', background: 'var(--color-canvas)' }}>
        <h1 style={{ fontSize: 32, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 6 }}>כלל הנתונים</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          {filtered.length} עסקים{businesses.length !== filtered.length ? ` מתוך ${businesses.length}` : ''}
        </p>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 48px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="חיפוש לפי שם, כתובת, סוג עסק..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)} style={inputStyle}>
          <option value="הכל">כל הדירוגים</option>
          {ALL_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
          <option value="הכל">כל סוגי העסק</option>
          {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל') }}
            style={{ ...inputStyle, cursor: 'pointer', color: 'var(--color-muted)' }}
          >
            נקה סינון
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ padding: '0 48px 96px' }}>
        {businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '96px 0' }}>
            <p style={{ fontSize: 32, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 12 }}>אין עסקים במערכת</p>
            <a href="/upload" style={btnPrimary}>העלה דוח ראשון</a>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
                  <th style={th}></th>
                  <th style={th}>שם העסק</th>
                  <th style={th}>סוג עסק</th>
                  <th style={th}>כתובת</th>
                  <th style={th}>דירוג חשד</th>
                  <th style={th}>יחידות</th>
                  <th style={th}>תאריך</th>
                  <th style={{ ...th, width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--color-muted)' }}>
                      לא נמצאו תוצאות
                    </td>
                  </tr>
                ) : filtered.map((b, idx) => (
                  <>
                    <tr
                      key={b.id}
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: `1px solid var(--color-hairline)`,
                        background: expanded === b.id ? 'var(--color-surface-soft)' : idx % 2 === 0 ? 'var(--color-canvas)' : 'var(--color-canvas)',
                      }}
                      className="group"
                    >
                      <td style={{ ...td, color: 'var(--color-muted)', width: 32, fontSize: 10 }}>
                        {expanded === b.id ? '▾' : '▸'}
                      </td>
                      <td style={{ ...td, fontWeight: 500, color: 'var(--color-ink)' }}>{b.name}</td>
                      <td style={{ ...td, color: 'var(--color-muted)' }}>{b.type}</td>
                      <td style={{ ...td, color: 'var(--color-body)' }}>{b.address}</td>
                      <td style={td}>
                        <span style={RATING_STYLE[b.suspicionRating] ?? { ...RATING_STYLE['דרוש בדיקה'], background: '#f8fafc', color: 'var(--color-muted)' }}>
                          {b.suspicionRating || '—'}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--color-muted)' }}>{b.unitCount || '—'}</td>
                      <td style={{ ...td, color: 'var(--color-muted)', fontSize: 12 }}>{b.uploadDate}</td>
                      <td style={td}>
                        <button
                          onClick={e => { e.stopPropagation(); deleteBusiness(b.id) }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-hairline)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                          title="מחק עסק"
                          className="group-hover:!text-red-400"
                        >
                          ×
                        </button>
                      </td>
                    </tr>

                    {expanded === b.id && (
                      <tr key={`${b.id}-exp`} style={{ background: 'var(--color-surface-soft)', borderBottom: `1px solid var(--color-hairline)` }}>
                        <td colSpan={8} style={{ padding: '20px 48px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 48px', fontSize: 14 }}>
                            {b.matchedAddress    && <Detail label="כתובת תואמת מהעירייה" value={b.matchedAddress} />}
                            {b.unitCount         && <Detail label="מספר יחידות בכתובת"  value={b.unitCount} />}
                            {b.suspicionDetail   && <Detail label="פירוט החשד"           value={b.suspicionDetail} full />}
                            {b.noSuspicionReason && <Detail label="סיבת אי-חשד"          value={b.noSuspicionReason} full />}
                            {b.propertyOwners    && <Detail label="שמות בעלי נכסים"      value={b.propertyOwners} full />}
                            {b.link && (
                              <div style={{ gridColumn: '1 / -1' }}>
                                <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>קישור למקור: </span>
                                <a href={b.link} target="_blank" rel="noopener noreferrer"
                                  style={{ color: '#1b61c9', textDecoration: 'none', wordBreak: 'break-all' }}>
                                  {b.link}
                                </a>
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

            <div style={{ padding: '12px 24px', background: 'var(--color-surface-soft)', borderTop: '1px solid var(--color-hairline)', color: 'var(--color-muted)', fontSize: 13 }}>
              מציג {filtered.length} מתוך {businesses.length} עסקים
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Detail({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : {}}>
      <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>{label}: </span>
      <span style={{ color: 'var(--color-body)' }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  height: 44, padding: '0 14px',
  border: '1px solid var(--color-hairline)',
  borderRadius: 6, fontSize: 14,
  color: 'var(--color-ink)',
  background: 'var(--color-canvas)',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-block', padding: '14px 24px',
  background: 'var(--color-ink)', color: '#fff',
  borderRadius: 12, fontSize: 16, fontWeight: 500,
  textDecoration: 'none',
}

const th: React.CSSProperties = {
  textAlign: 'right', padding: '12px 16px',
  fontSize: 13, fontWeight: 500,
  color: 'var(--color-muted)',
}

const td: React.CSSProperties = {
  padding: '14px 16px',
  color: 'var(--color-body)',
  verticalAlign: 'middle',
}
