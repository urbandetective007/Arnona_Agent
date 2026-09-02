'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'

const RESULT_STYLE: Record<string, React.CSSProperties> = {
  'נמצא פער בסיווג':      { background: '#fff7ed', color: '#c2410c' },
  'נמצא פער שטח + סיווג': { background: '#fef2f2', color: '#b91c1c' },
  'נמצא פער שטח':         { background: '#fefce8', color: '#a16207' },
  'לא נמצא עסק/פער שטח':  { background: '#f0fdf4', color: '#15803d' },
}

export default function SurveyTrackingPage() {
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

  const sent = useMemo(() => businesses.filter(b => b.sentToInspector === 'נשלח לסוקר'), [businesses])
  const declined = useMemo(() => businesses.filter(b => b.sentToInspector === 'הוחלט לא לשלוח לסקר'), [businesses])
  const withResult = useMemo(() => sent.filter(b => b.surveyResultDetail), [sent])
  const pending = useMemo(() => sent.filter(b => !b.surveyResultDetail), [sent])
  const completionPct = sent.length > 0 ? Math.round((withResult.length / sent.length) * 100) : 0

  const resultBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    withResult.forEach(b => {
      const key = b.surveyResultDetail as string
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [withResult])

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  return (
    <AppLayout>
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>ניתוח ארנונה · עיריית ירושלים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>מעקב תוצאות סקר</h1>
        <p style={{ color: 'var(--charcoal)', marginTop: 6 }}>
          מה קרה עם הנכסים שנשלחו לסוקר השטח — כמה טופלו וכמה עדיין ממתינים
        </p>
      </section>

      <section style={{ background: 'var(--cloud)', padding: '32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'נשלחו לסוקר',     value: sent.length,         note: 'סה״כ' },
            { label: 'התקבלה תוצאה',    value: withResult.length,   note: `${completionPct}% מהנשלחים` },
            { label: 'ממתינים לתוצאה',  value: pending.length,      note: 'טרם דווח' },
            { label: 'הוחלט לא לשלוח',  value: declined.length,     note: 'לא נשלחו לסקר' },
          ].map(({ label, value, note }) => (
            <div key={label} style={metricCard}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
              <p style={{ fontSize: 40, fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 13, color: 'var(--graphite)', marginTop: 6 }}>{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: 'var(--canvas)', padding: '32px 48px 80px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 500, marginBottom: 24 }}>פילוח ממצאי הסקר</h2>
        {resultBreakdown.length === 0 ? (
          <p style={{ color: 'var(--graphite)' }}>עדיין אין תוצאות סקר שדווחו</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 720 }}>
            {resultBreakdown.map(([result, count]) => (
              <div key={result} style={{ background: 'var(--cloud)', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                <span style={{ ...(RESULT_STYLE[result] ?? {}), borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{result}</span>
                <p style={{ fontSize: 32, fontWeight: 500, color: 'var(--ink)', marginTop: 10 }}>{count}</p>
                <p style={{ fontSize: 13, color: 'var(--graphite)', marginTop: 4 }}>
                  {withResult.length > 0 ? Math.round((count / withResult.length) * 100) : 0}% מהדיווחים
                </p>
              </div>
            ))}
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
const metricCard: React.CSSProperties = { background: 'var(--canvas)', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }
