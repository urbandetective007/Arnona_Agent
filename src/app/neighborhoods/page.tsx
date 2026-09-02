'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'

interface NeighborhoodRow {
  neighborhood: string
  total: number
  high: number
  mid: number
  notSuspect: number
  suspectPct: number
}

export default function NeighborhoodsPage() {
  const ready = useRequireRole(['employee', 'manager'])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) { setBusinesses(cached); setLoading(false) }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const rows = useMemo<NeighborhoodRow[]>(() => {
    const byNeighborhood = new Map<string, Business[]>()
    businesses.forEach(b => {
      const key = b.neighborhood || 'ללא שכונה משויכת'
      const list = byNeighborhood.get(key) ?? []
      list.push(b)
      byNeighborhood.set(key, list)
    })
    return [...byNeighborhood.entries()]
      .map(([neighborhood, list]) => {
        const high = list.filter(b => b.suspicionRating === 'גבוה').length
        const mid  = list.filter(b => b.suspicionRating === 'בינוני').length
        return {
          neighborhood,
          total: list.length,
          high,
          mid,
          notSuspect: list.filter(b => b.suspicionRating === 'לא חשוד').length,
          suspectPct: list.length > 0 ? Math.round(((high + mid) / list.length) * 100) : 0,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [businesses])

  const maxTotal = Math.max(...rows.map(r => r.total), 1)

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>ניתוח ארנונה · עיריית ירושלים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>פילוח שכונות</h1>
        <p style={{ color: 'var(--charcoal)', marginTop: 6 }}>
          כמות נכסים ואחוז אינדיקציה לכל שכונה — לזיהוי אזורים חמים
        </p>
      </section>

      <section style={{ background: 'var(--cloud)', padding: '32px 48px 80px' }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--graphite)' }}>אין נתונים להצגה</div>
        ) : (
          <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)', background: 'var(--canvas)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                    {['שכונה', 'סה״כ נכסים', 'אינדיקציה גבוהה', 'אינדיקציה בינונית', 'לא חשוד', 'שיעור אינדיקציה'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.neighborhood} style={{ borderBottom: '1px solid var(--hairline)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--ink)' }}>{r.neighborhood}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--charcoal)' }}>{r.total}</td>
                      <td style={{ padding: '14px 16px', color: '#b91c1c' }}>{r.high}</td>
                      <td style={{ padding: '14px 16px', color: '#c2410c' }}>{r.mid}</td>
                      <td style={{ padding: '14px 16px', color: '#15803d' }}>{r.notSuspect}</td>
                      <td style={{ padding: '14px 16px', minWidth: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--fog)', borderRadius: 9999 }}>
                            <div style={{ height: '100%', width: `${(r.total / maxTotal) * 100}%`, background: r.suspectPct >= 50 ? '#b91c1c' : 'var(--hp-blue)', borderRadius: 9999 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.suspectPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
