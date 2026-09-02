'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import AppLayout from '@/components/AppLayout'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'

// Spinner placeholder component
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--fog)', borderTopColor: 'var(--hp-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

// Dynamically import map component with SSR disabled
const JerusalemMap = dynamic(() => import('@/components/JerusalemMap'), {
  ssr: false,
  loading: () => <Spinner />,
})

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']

export default function MapPage() {
  const ready = useRequireRole(['employee', 'manager'])
  const [businesses,   setBusinesses]   = useState<Business[]>([])
  const [search,       setSearch]       = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter,   setTypeFilter]   = useState('הכל')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('הכל')
  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [loading,      setLoading]      = useState(true)

  // Load from cache or Supabase
  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) { 
      setBusinesses(cached)
      setLoading(false) 
    }
    
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { 
        const b = data.map(dbToBusiness)
        setBusinesses(b)
        setCache('businesses', b) 
      }
      setLoading(false)
    })
  }, [])

  // Extract unique business categories
  const types = useMemo(() =>
    [...new Set(businesses.map(b => b.type).filter(Boolean))].sort()
  , [businesses])

  // Extract unique neighborhoods
  const neighborhoods = useMemo(() =>
    [...new Set(businesses.map(b => b.neighborhood).filter(Boolean))].sort()
  , [businesses])

  // Only offer ratings that at least one current business actually has
  const ratingsInUse = useMemo(() =>
    ALL_RATINGS.filter(r => businesses.some(b => b.suspicionRating === r))
  , [businesses])

  // Filter businesses
  const filtered = useMemo(() => businesses.filter(b => {
    const q = search.toLowerCase()
    const ms = !q || [b.name, b.address, b.type, b.neighborhood ?? '', b.propertyOwners ?? ''].some(s => s.toLowerCase().includes(q))
    return ms && (ratingFilter === 'הכל' || b.suspicionRating === ratingFilter)
              && (typeFilter   === 'הכל' || b.type === typeFilter)
              && (neighborhoodFilter === 'הכל' || b.neighborhood === neighborhoodFilter)
  }), [businesses, search, ratingFilter, typeFilter, neighborhoodFilter])

  const activeFilterCount = [ratingFilter, typeFilter, neighborhoodFilter].filter(f => f !== 'הכל').length

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  // Mapped counts
  const highRisk = filtered.filter(b => b.suspicionRating === 'גבוה').length
  const needsCheck = filtered.filter(b => b.suspicionRating === 'דרוש בדיקה').length

  return (
    <AppLayout>
      {/* Title Section */}
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>פריסה מרחבית</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>מפת נכסים</h1>
      </section>

      {/* Filter Section */}
      <section style={{ background: 'var(--cloud)', padding: '20px 48px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="חיפוש לפי שם, כתובת, סוג עסק..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <button onClick={() => setFiltersOpen(o => !o)} style={{ ...btnOutlineInk, display: 'flex', alignItems: 'center', gap: 6 }}>
            בחר סננים{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: filtersOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          <span style={{ marginRight: 'auto', fontSize: 13, color: 'var(--graphite)', whiteSpace: 'nowrap' }}>
            מציג {filtered.length} מתוך {businesses.length} עסקים
          </span>
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
            {(search || activeFilterCount > 0) && (
              <button onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל'); setNeighborhoodFilter('הכל') }} style={btnOutlineInk}>
                נקה סינון
              </button>
            )}
          </div>
        )}
      </section>

      {/* Stats Summary Grid */}
      <section style={{ background: 'var(--cloud)', padding: '0px 48px 24px 48px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={statCard}>
            <span style={{ ...indicator, background: '#ef4444' }} />
            <span style={statLabel}>אינדיקציה גבוהה:</span>
            <span style={statVal}>{highRisk}</span>
          </div>
          <div style={statCard}>
            <span style={{ ...indicator, background: '#3b82f6' }} />
            <span style={statLabel}>דרוש בדיקה:</span>
            <span style={statVal}>{needsCheck}</span>
          </div>
        </div>
      </section>

      {/* Map Container */}
      <section style={{ background: 'var(--canvas)', padding: '0 48px 24px', display: 'flex', flexDirection: 'column', height: '580px' }}>
        {businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', border: '1px solid var(--hairline)', borderRadius: 16 }}>
            <p style={{ fontSize: 32, fontWeight: 500, marginBottom: 16 }}>אין עסקים להצגה על המפה</p>
            <Link href="/upload" style={btnBlue}>העלאת דוח ראשון</Link>
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative' }}>
            <JerusalemMap businesses={filtered} />
          </div>
        )}
      </section>

      {/* Spacious bottom margin to allow natural scrolling and show where the map ends */}
      <div style={{ height: '100px', background: 'var(--canvas)', borderTop: '1px solid var(--hairline)', margin: '0 48px' }} />


    </AppLayout>
  )
}

const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }
const inputStyle: React.CSSProperties = { height: 44, padding: '0 14px', border: '1px solid var(--steel)', borderRadius: 4, fontSize: 14, color: 'var(--ink)', background: 'var(--canvas)', outline: 'none' }
const btnBlue: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--hp-blue)', color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none' }
const btnOutlineInk: React.CSSProperties = { height: 44, padding: '0 16px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }

const statCard: React.CSSProperties = { display: 'flex', alignItems: 'center', background: 'var(--canvas)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 14px', fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
const indicator: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', marginLeft: 8 }
const statLabel: React.CSSProperties = { color: 'var(--charcoal)', marginLeft: 4, fontWeight: 500 }
const statVal: React.CSSProperties = { color: 'var(--ink)', fontWeight: 700 }
