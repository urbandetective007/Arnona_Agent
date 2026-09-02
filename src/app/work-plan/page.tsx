'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness, businessToDb } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'

const BADGE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#b91c1c' },
  'בינוני':      { background: '#fff7ed', color: '#c2410c' },
  'לא חשוד':    { background: '#f0fdf4', color: '#15803d' },
  'דרוש בדיקה': { background: 'var(--cloud)', color: 'var(--charcoal)' },
}

const SURVEY_RESULT_OPTIONS = ['נמצא פער בסיווג', 'נמצא פער שטח + סיווג', 'נמצא פער שטח', 'לא נמצא עסק/פער שטח']

const NO_NEIGHBORHOOD = 'ללא שכונה משויכת'

export default function WorkPlanPage() {
  const ready = useRequireRole(['employee', 'surveyor'])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading,    setLoading]    = useState(true)
  // undefined = user hasn't toggled anything yet, so default to the first (largest) group
  const [openNeighborhood, setOpenNeighborhood] = useState<string | null | undefined>(undefined)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [resultDraft,  setResultDraft] = useState('')
  const [saving,       setSaving]      = useState<string | null>(null)

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) { setBusinesses(cached); setLoading(false) }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const pending = useMemo(
    () => businesses.filter(b => b.sentToInspector === 'נשלח לסוקר' && !b.surveyResultDetail),
    [businesses]
  )

  const groups = useMemo(() => {
    const byNeighborhood = new Map<string, Business[]>()
    pending.forEach(b => {
      const key = b.neighborhood || NO_NEIGHBORHOOD
      const list = byNeighborhood.get(key) ?? []
      list.push(b)
      byNeighborhood.set(key, list)
    })
    return [...byNeighborhood.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'he'))
  }, [pending])

  const effectiveOpen = openNeighborhood !== undefined ? openNeighborhood : (groups[0]?.[0] ?? null)

  function startReport(b: Business) {
    setReportingId(b.id)
    setResultDraft(b.surveyResultDetail ?? '')
  }

  async function saveReport(id: string) {
    if (!resultDraft) { alert('יש לבחור תוצאת סקר'); return }
    setSaving(id)
    try {
      const business = businesses.find(b => b.id === id)
      if (!business) return
      const updated: Business = { ...business, surveyResultDetail: resultDraft as Business['surveyResultDetail'] }
      const { error } = await supabase.from('businesses').update(businessToDb(updated)).eq('id', id)
      if (error) { alert(`שגיאה בשמירה: ${error.message}`); return }
      setBusinesses(prev => {
        const next = prev.map(b => b.id === id ? updated : b)
        setCache('businesses', next)
        return next
      })
      setReportingId(null)
    } finally {
      setSaving(null)
    }
  }

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>סוקר שטח · עיריית ירושלים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>תוכנית עבודה</h1>
        <p style={{ color: 'var(--charcoal)', marginTop: 6 }}>
          {pending.length} נכסים ממתינים לסקר, מקובצים לפי שכונה — כדי לעבוד שכונה אחר שכונה
        </p>
      </section>

      <section style={{ background: 'var(--cloud)', padding: '32px 48px 80px' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--graphite)' }}>
            אין נכסים הממתינים לסקר כרגע
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groups.map(([neighborhood, list]) => {
              const open = effectiveOpen === neighborhood
              return (
                <div key={neighborhood} style={{ background: 'var(--canvas)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                  <div
                    onClick={() => setOpenNeighborhood(open ? null : neighborhood)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', cursor: 'pointer', background: open ? 'var(--fog)' : 'var(--canvas)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--steel)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>{neighborhood}</h2>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--graphite)' }}>{list.length} נכסים</span>
                  </div>

                  {open && (
                    <div style={{ borderTop: '1px solid var(--hairline)' }}>
                      {list.map(b => (
                        <div key={b.id} style={{ padding: '16px 24px', borderBottom: '1px solid var(--hairline)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.name}</p>
                              <p style={{ fontSize: 13, color: 'var(--charcoal)', marginTop: 2 }}>{b.address}</p>
                              {b.propertyOwners && (
                                <p style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>בעלי נכס: {b.propertyOwners}</p>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              {b.suspicionRating && (
                                <span style={{ ...badge, ...(BADGE[b.suspicionRating] ?? { background: 'var(--cloud)', color: 'var(--charcoal)' }) }}>
                                  {b.suspicionRating}
                                </span>
                              )}
                              {reportingId !== b.id && (
                                <button onClick={() => startReport(b)} style={btnOutlineInk}>דיווח ממצאי סקר</button>
                              )}
                            </div>
                          </div>

                          {reportingId === b.id && (
                            <div style={{ marginTop: 14, padding: 16, background: 'var(--cloud)', borderRadius: 8, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 220 }}>
                                <label style={editLabel}>תוצאת הסקר</label>
                                <select value={resultDraft} onChange={e => setResultDraft(e.target.value)} style={editInput}>
                                  <option value="">בחר תוצאה...</option>
                                  {SURVEY_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              <button onClick={() => saveReport(b.id)} disabled={saving === b.id} style={btnBlue2}>
                                {saving === b.id ? 'שומר...' : 'שמור'}
                              </button>
                              <button onClick={() => setReportingId(null)} style={btnOutlineInk}>ביטול</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
const badge: React.CSSProperties = { borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }
const btnOutlineInk: React.CSSProperties = { height: 36, padding: '0 14px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 13, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnBlue2: React.CSSProperties = { height: 40, padding: '0 20px', background: 'var(--hp-blue)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const editLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }
const editInput: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--steel)', borderRadius: 4, fontSize: 14, color: 'var(--ink)', background: 'var(--canvas)', outline: 'none', boxSizing: 'border-box' as const }
