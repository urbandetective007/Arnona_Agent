'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, dbToBusiness, dbToSession } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { formatDate } from '@/lib/dateUtils'

export default function Dashboard() {
  const ready = useRequireAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions,   setSessions]   = useState<UploadSession[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const cachedB = getCache<Business[]>('businesses')
    const cachedS = getCache<UploadSession[]>('sessions')
    if (cachedB && cachedS) {
      setBusinesses(cachedB); setSessions(cachedS); setLoading(false)
    }
    Promise.all([
      supabase.from('businesses').select('*'),
      supabase.from('upload_sessions').select('*'),
    ]).then(([{ data: bData }, { data: sData }]) => {
      if (bData) { const b = bData.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      if (sData) { const s = sData.map(dbToSession);  setSessions(s);   setCache('sessions', s) }
      setLoading(false)
    })
  }, [])

  if (!ready) return null
  if (loading) return <AppLayout><Spinner /></AppLayout>

  const total      = businesses.length
  const highRisk   = businesses.filter(b => b.suspicionRating === 'גבוה').length
  const midRisk    = businesses.filter(b => b.suspicionRating === 'בינוני').length
  const notSuspect = businesses.filter(b => b.suspicionRating === 'לא חשוד').length
  const needsCheck = businesses.filter(b => b.suspicionRating === 'דרוש בדיקה').length
  const suspectPct = total > 0 ? Math.round(((highRisk + midRisk) / total) * 100) : 0
  const lastSession = sessions.at(-1)

  const typeMap: Record<string, number> = {}
  businesses.forEach(b => { if (b.type) typeMap[b.type] = (typeMap[b.type] || 0) + 1 })
  const topTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxType  = Math.max(...topTypes.map(t => t[1]), 1)

  const unitNums = businesses.map(b => parseInt(b.unitCount)).filter(n => !isNaN(n))
  const avgUnits = unitNums.length > 0 ? (unitNums.reduce((a, b) => a + b, 0) / unitNums.length).toFixed(1) : '—'

  if (total === 0) return (
    <AppLayout>
      <Section bg="var(--canvas)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>דשבורד</h1>
        <p style={{ color: 'var(--charcoal)', fontSize: 16 }}>אין נתונים — העלה דוח יומי כדי להתחיל</p>
        <Link href="/upload" style={btnBlue}>העלאת דוח חדש</Link>
      </Section>
    </AppLayout>
  )

  return (
    <AppLayout>
      <Section bg="var(--canvas)">
        <p style={eyebrow}>ניתוח ארנונה · עיריית ירושלים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500, marginBottom: 8 }}>דשבורד</h1>
        <p style={{ color: 'var(--charcoal)', fontSize: 16 }}>
          {total.toLocaleString()} עסקים במערכת &nbsp;·&nbsp; {sessions.length} קבצים שהועלו
        </p>
      </Section>

      <Section bg="var(--cloud)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'סה״כ עסקים',   value: total,      note: 'במערכת' },
            { label: 'אינדיקציה גבוהה', value: highRisk,   note: 'עסקים'  },
            { label: 'שיעור אינדיקציה', value: `${suspectPct}%`, note: 'מהעסקים' },
            { label: 'קבצים שהועלו', value: sessions.length, note: 'מאז ההתחלה' },
          ].map(({ label, value, note }) => (
            <div key={label} style={metricCard}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
              <p style={{ fontSize: 40, fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 13, color: 'var(--graphite)', marginTop: 6 }}>{note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="var(--canvas)">
        <h2 style={{ fontSize: 32, fontWeight: 500, marginBottom: 32 }}>התפלגות דירוג אינדיקציה</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 720 }}>
          {[
            { label: 'אינדיקציה גבוהה', count: highRisk,   color: '#b91c1c' },
            { label: 'אינדיקציה בינונית', count: midRisk,    color: '#d97706' },
            { label: 'דרוש בדיקה', count: needsCheck, color: '#6b7280' },
            { label: 'לא חשוד',    count: notSuspect, color: '#15803d' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ background: 'var(--cloud)', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
              <p style={{ fontSize: 36, fontWeight: 500, color: 'var(--ink)' }}>{count}</p>
              <div style={{ height: 4, background: 'var(--fog)', borderRadius: 9999, marginTop: 12 }}>
                <div style={{ height: '100%', width: `${total > 0 ? (count/total)*100 : 0}%`, background: color, borderRadius: 9999 }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--graphite)', marginTop: 6 }}>
                {total > 0 ? Math.round((count/total)*100) : 0}% מהעסקים
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="var(--ink)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 48 }}>
          <div>
            <p style={{ ...eyebrow, color: 'var(--steel)' }}>ממצא מרכזי</p>
            <h2 style={{ fontSize: 44, fontWeight: 500, color: 'var(--on-ink)', marginBottom: 12 }}>
              {highRisk} עסקים באינדיקציה גבוהה
            </h2>
            <p style={{ color: 'var(--steel)', fontSize: 16, maxWidth: 480, lineHeight: 1.5 }}>
              עסקים הפועלים בכתובות שכל יחידותיהן מסווגות כמגורים — אינדיקציה חזקה לתשלום ארנונה מופחת שלא כדין.
            </p>
          </div>
          <Link href="/businesses" style={{ ...btnWhiteOnDark, flexShrink: 0 }}>צפה בכל העסקים</Link>
        </div>
      </Section>

      {topTypes.length > 0 && (
        <Section bg="var(--cloud)">
          <h2 style={{ fontSize: 32, fontWeight: 500, marginBottom: 24 }}>סוגי עסקים נפוצים</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {topTypes.map(([type, count]) => (
              <div key={type} style={{ background: 'var(--canvas)', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                <p style={{ fontSize: 36, fontWeight: 500, color: 'var(--hp-blue)', lineHeight: 1, marginBottom: 8 }}>{count}</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{type}</p>
                <div style={{ height: 3, background: 'var(--fog)', borderRadius: 9999, marginTop: 14 }}>
                  <div style={{ height: '100%', width: `${(count/maxType)*100}%`, background: 'var(--hp-blue)', borderRadius: 9999 }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {lastSession && (
        <Section bg="var(--canvas)">
          <h2 style={{ fontSize: 32, fontWeight: 500, marginBottom: 24 }}>העלאה אחרונה</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'שם הקובץ',     value: lastSession.fileName    },
              { label: 'תאריך',         value: formatDate(lastSession.uploadDate)  },
              { label: 'סה״כ עסקים',   value: String(lastSession.totalCount) },
              { label: 'אינדיקציות',    value: String(lastSession.suspiciousCount) },
              { label: 'ממוצע יחידות', value: avgUnits                },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--cloud)', borderRadius: 16, padding: '16px 24px', minWidth: 140, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 500, color: 'var(--ink)', wordBreak: 'break-all' }}>{value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section bg="var(--ink)" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
        <div>
          <h2 style={{ fontSize: 32, fontWeight: 500, color: 'var(--on-ink)', marginBottom: 8 }}>מוכן להעלאת דוח חדש?</h2>
          <p style={{ color: 'var(--steel)', fontSize: 16 }}>הוסף נתונים חדשים למערכת בקלות</p>
        </div>
        <Link href="/upload" style={{ ...btnBlue, flexShrink: 0 }}>העלאת דוח חדש</Link>
      </Section>
    </AppLayout>
  )
}

function Section({ bg, children, style }: { bg: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ background: bg, padding: '64px 48px', ...style }}>{children}</section>
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--fog)', borderTopColor: 'var(--hp-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}

const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }
const metricCard: React.CSSProperties = { background: 'var(--canvas)', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(26,26,26,0.08)' }
const btnBlue: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--hp-blue)', color: 'var(--on-ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }
const btnWhiteOnDark: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }
