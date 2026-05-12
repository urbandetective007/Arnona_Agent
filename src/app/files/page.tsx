'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, dbToBusiness, dbToSession, sessionToDb } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'

const BADGE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#b91c1c' },
  'בינוני':      { background: '#fff7ed', color: '#c2410c' },
  'לא חשוד':    { background: '#f0fdf4', color: '#15803d' },
  'דרוש בדיקה': { background: 'var(--cloud)', color: 'var(--charcoal)' },
}

export default function FilesPage() {
  const ready = useRequireAuth()
  const [sessions,   setSessions]   = useState<UploadSession[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const cachedS = getCache<UploadSession[]>('sessions')
    const cachedB = getCache<Business[]>('businesses')
    if (cachedS && cachedB) {
      setSessions(cachedS); setBusinesses(cachedB); setLoading(false)
    }
    Promise.all([
      supabase.from('upload_sessions').select('*'),
      supabase.from('businesses').select('*'),
    ]).then(([{ data: sData }, { data: bData }]) => {
      if (sData) { const s = sData.map(dbToSession);  setSessions(s);   setCache('sessions', s) }
      if (bData) { const b = bData.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  async function deleteSession(id: string) {
    if (!confirm('למחוק את הקובץ וכל העסקים שלו?')) return
    await supabase.from('upload_sessions').delete().eq('id', id)
    const nextS = sessions.filter(s => s.id !== id)
    const nextB = businesses.filter(b => b.uploadSessionId !== id)
    setSessions(nextS); setBusinesses(nextB)
    setCache('sessions', nextS); setCache('businesses', nextB)
    if (selectedId === id) setSelectedId(null)
  }

  async function deleteBusiness(id: string) {
    await supabase.from('businesses').delete().eq('id', id)
    const next = businesses.filter(b => b.id !== id)
    setBusinesses(next); setCache('businesses', next)

    const nextSessions = await Promise.all(sessions.map(async s => {
      if (!s.businessIds.includes(id)) return s
      const upd = next.filter(b => s.businessIds.includes(b.id))
      const updated: UploadSession = {
        ...s,
        totalCount: upd.length,
        suspiciousCount: upd.filter(b => b.arnonaStatus === 'suspicious').length,
        okCount: upd.filter(b => b.arnonaStatus === 'ok').length,
        unknownCount: upd.filter(b => b.arnonaStatus === 'unknown').length,
        businessIds: upd.map(b => b.id),
      }
      await supabase.from('upload_sessions').update(sessionToDb(updated)).eq('id', s.id)
      return updated
    }))
    setSessions(nextSessions); setCache('sessions', nextSessions)
  }

  async function clearAll() {
    if (!confirm('למחוק את כל הנתונים? פעולה זו בלתי הפיכה.')) return
    await supabase.from('businesses').delete().neq('id', '')
    await supabase.from('upload_sessions').delete().neq('id', '')
    setSessions([]); setBusinesses([]); setSelectedId(null)
    setCache('businesses', []); setCache('sessions', [])
  }

  const selected = sessions.find(s => s.id === selectedId)
  const selBiz   = selectedId ? businesses.filter(b => b.uploadSessionId === selectedId) : []

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={eyebrow}>היסטוריית העלאות</p>
          <h1 style={{ fontSize: 44, fontWeight: 500 }}>קבצים שהועלו</h1>
          <p style={{ color: 'var(--charcoal)', marginTop: 6 }}>{sessions.length} קבצים · {businesses.length} עסקים סה״כ</p>
        </div>
        {(sessions.length > 0 || businesses.length > 0) && (
          <button onClick={clearAll} style={btnDanger}>נקה את כל הנתונים</button>
        )}
      </section>

      {sessions.length === 0 && businesses.length === 0 ? (
        <section style={{ background: 'var(--cloud)', padding: '80px 48px', textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 500, marginBottom: 16 }}>לא הועלו קבצים עדיין</p>
          <Link href="/upload" style={btnBlue}>העלאת קובץ ראשון</Link>
        </section>
      ) : (
        <section style={{ background: 'var(--cloud)', padding: '32px 48px 80px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Sessions list */}
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...sessions].reverse().map(session => {
              const active = selectedId === session.id
              return (
                <div key={session.id} onClick={() => setSelectedId(active ? null : session.id)}
                  style={{ background: 'var(--canvas)', borderRadius: 16, padding: 20, cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,26,26,0.08)', border: active ? '2px solid var(--hp-blue)' : '2px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.fileName}</p>
                      <p style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 3 }}>{session.uploadDate}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                      style={{ background: 'none', border: 'none', color: 'var(--steel)', cursor: 'pointer', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Chip label={`סה״כ: ${session.totalCount}`} />
                    {session.suspiciousCount > 0 && <Chip label={`חשוד: ${session.suspiciousCount}`} color="#b91c1c" bg="#fef2f2" />}
                    {session.okCount > 0 && <Chip label={`תקין: ${session.okCount}`} color="#15803d" bg="#f0fdf4" />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Businesses panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selectedId ? (
              <div style={{ background: 'var(--canvas)', borderRadius: 16, padding: 48, textAlign: 'center', color: 'var(--graphite)', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                בחר קובץ מהרשימה כדי לראות את הנכסים שלו
              </div>
            ) : (
              <div style={{ background: 'var(--canvas)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                <div style={{ padding: '16px 24px', background: 'var(--fog)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{selected?.fileName}</p>
                    <p style={{ fontSize: 12, color: 'var(--graphite)', marginTop: 2 }}>{selBiz.length} עסקים</p>
                  </div>
                  <button onClick={() => deleteSession(selectedId)} style={btnDanger}>מחק קובץ</button>
                </div>

                <div style={{ overflow: 'auto', maxHeight: 560 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--cloud)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                        {['שם העסק', 'כתובת', 'דירוג', 'פירוט', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selBiz.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--graphite)' }}>אין עסקים בקובץ זה</td></tr>
                      ) : selBiz.map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink)' }}>{b.name}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--charcoal)' }}>{b.address}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {b.suspicionRating
                              ? <span style={{ ...badgeBase, ...(BADGE[b.suspicionRating] ?? { background: 'var(--cloud)', color: 'var(--charcoal)' }) }}>{b.suspicionRating}</span>
                              : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--graphite)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.suspicionDetail || b.noSuspicionReason}>
                            {b.suspicionDetail || b.noSuspicionReason || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => { if (confirm(`למחוק "${b.name}"?`)) deleteBusiness(b.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--steel)', fontSize: 18, lineHeight: 1 }}>
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section style={{ background: 'var(--ink)', padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: 'var(--steel)', fontSize: 16 }}>להוספת נתונים חדשים — העלה דוח יומי</p>
        <Link href="/upload" style={btnWhite}>העלאת דוח חדש</Link>
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

function Chip({ label, color = 'var(--charcoal)', bg = 'var(--cloud)' }: { label: string; color?: string; bg?: string }) {
  return <span style={{ fontSize: 12, fontWeight: 600, color, background: bg, borderRadius: 4, padding: '2px 8px' }}>{label}</span>
}

const eyebrow:   React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }
const badgeBase: React.CSSProperties = { borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }
const btnBlue:   React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--hp-blue)', color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none' }
const btnWhite:  React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none', flexShrink: 0 }
const btnDanger: React.CSSProperties = { height: 36, padding: '0 14px', background: 'none', border: '1px solid #b91c1c', color: '#b91c1c', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }
