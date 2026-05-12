'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business, UploadSession } from '@/lib/types'

export default function Dashboard() {
  const ready = useRequireAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions,   setSessions]   = useState<UploadSession[]>([])

  useEffect(() => {
    const b = localStorage.getItem('businesses')
    const s = localStorage.getItem('uploadSessions')
    if (b) setBusinesses(JSON.parse(b))
    if (s) setSessions(JSON.parse(s))
  }, [])

  if (!ready) return null

  const total      = businesses.length
  const highRisk   = businesses.filter(b => b.suspicionRating === 'גבוה').length
  const midRisk    = businesses.filter(b => b.suspicionRating === 'בינוני').length
  const notSuspect = businesses.filter(b => b.suspicionRating === 'לא חשוד').length
  const needsCheck = businesses.filter(b => b.suspicionRating === 'דרוש בדיקה').length
  const suspectPct = total > 0 ? Math.round(((highRisk + midRisk) / total) * 100) : 0

  // Top business types
  const typeMap: Record<string, number> = {}
  businesses.forEach(b => { if (b.type) typeMap[b.type] = (typeMap[b.type] || 0) + 1 })
  const topTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxType  = Math.max(...topTypes.map(t => t[1]), 1)

  // Unit stats
  const unitNums  = businesses.map(b => parseInt(b.unitCount)).filter(n => !isNaN(n))
  const avgUnits  = unitNums.length > 0 ? (unitNums.reduce((a, b) => a + b, 0) / unitNums.length).toFixed(1) : '—'

  const lastSession = sessions.at(-1)

  const demoColors = [
    'var(--color-sig-peach)',
    'var(--color-sig-mint)',
    'var(--color-sig-yellow)',
    'var(--color-sig-cream)',
    '#e8d5f5',
    '#c9e4f5',
  ]

  // Empty state
  if (total === 0) return (
    <AppLayout>
      <div style={{ padding: '96px 48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 40, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 16 }}>דשבורד</h1>
        <p style={{ color: 'var(--color-muted)', marginBottom: 32 }}>העלה דוח יומי כדי לראות סטטיסטיקות</p>
        <a href="/upload" style={btnPrimary}>העלאת דוח חדש</a>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      {/* ── Hero band ── */}
      <section style={{ padding: '64px 48px 48px', background: 'var(--color-canvas)' }}>
        <p style={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', marginBottom: 12 }}>
          עיריית ירושלים
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 8 }}>דשבורד</h1>
        <p style={{ color: 'var(--color-body)', fontSize: 14 }}>
          {total} עסקים במערכת · {sessions.length} קבצים שהועלו
        </p>
      </section>

      {/* ── Metric cards ── */}
      <section style={{ padding: '0 48px 48px', background: 'var(--color-canvas)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'סה״כ עסקים',   value: total,      sub: 'במערכת'         },
            { label: 'חשד גבוה',     value: highRisk,   sub: 'עסקים'          },
            { label: 'שיעור חשד',    value: `${suspectPct}%`, sub: 'מכלל העסקים' },
            { label: 'קבצים שהועלו', value: sessions.length, sub: 'מאז ההתחלה' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)', borderRadius: 10, padding: 24 }}>
              <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: 36, fontWeight: 400, color: 'var(--color-ink)', lineHeight: 1.1 }}>{value}</p>
              <p style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 4 }}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Signature coral card ── */}
      <section style={{ padding: '0 48px 24px' }}>
        <div style={{ background: 'var(--color-sig-coral)', borderRadius: 12, padding: 48 }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', marginBottom: 12 }}>
            ממצא מרכזי
          </p>
          <h2 style={{ fontSize: 32, fontWeight: 400, color: '#fff', marginBottom: 16 }}>
            {highRisk} עסקים בחשד גבוה
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, maxWidth: 520, marginBottom: 32, lineHeight: 1.6 }}>
            עסקים אלה פועלים בכתובות שבהן כל הנכסים מסווגים כמגורים — חשד חזק לתשלום ארנונת מגורים שלא כדין.
          </p>
          <a href="/businesses" style={{ ...btnOnDark }}>צפה בכל העסקים</a>
        </div>
      </section>

      {/* ── White body: Distribution ── */}
      <section style={{ padding: '48px', background: 'var(--color-canvas)' }}>
        <h2 style={{ fontSize: 24, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 32 }}>
          התפלגות דירוג חשד
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
          {[
            { label: 'חשד גבוה',    count: highRisk,   bar: 'var(--color-sig-coral)' },
            { label: 'חשד בינוני',  count: midRisk,    bar: '#d97706' },
            { label: 'דרוש בדיקה', count: needsCheck, bar: '#b45309' },
            { label: 'לא חשוד',    count: notSuspect, bar: '#166534' },
          ].map(({ label, count, bar }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--color-body)', fontSize: 14 }}>{label}</span>
                <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>
                  {count} {total > 0 ? `(${Math.round(count / total * 100)}%)` : ''}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--color-surface-strong)', borderRadius: 9999 }}>
                <div style={{ height: '100%', width: `${total > 0 ? (count / total) * 100 : 0}%`, background: bar, borderRadius: 9999, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo grid: Business types ── */}
      {topTypes.length > 0 && (
        <section style={{ padding: '0 48px 48px', background: 'var(--color-canvas)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 24 }}>
            סוגי עסקים נפוצים
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {topTypes.map(([type, count], i) => (
              <div key={type} style={{ background: demoColors[i % demoColors.length], borderRadius: 10, padding: 24 }}>
                <p style={{ fontSize: 28, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 4 }}>{count}</p>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{type}</p>
                <div style={{ marginTop: 12, height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 9999 }}>
                  <div style={{ height: '100%', width: `${(count / maxType) * 100}%`, background: 'rgba(0,0,0,0.25)', borderRadius: 9999 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Signature forest card: upload stats ── */}
      {lastSession && (
        <section style={{ padding: '0 48px 48px' }}>
          <div style={{ background: 'var(--color-sig-forest)', borderRadius: 12, padding: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', marginBottom: 12 }}>
                העלאה אחרונה
              </p>
              <h2 style={{ fontSize: 28, fontWeight: 400, color: '#fff', marginBottom: 8 }}>
                {lastSession.fileName}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{lastSession.uploadDate}</p>
            </div>
            <div style={{ display: 'flex', gap: 32, flexShrink: 0 }}>
              {[
                { label: 'סה״כ', value: lastSession.totalCount },
                { label: 'חשודים', value: lastSession.suspiciousCount },
                { label: 'תקינים', value: lastSession.okCount },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 32, fontWeight: 400, color: '#fff' }}>{value}</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA band ── */}
      <section style={{ padding: '0 48px 96px' }}>
        <div style={{ background: 'var(--color-surface-strong)', borderRadius: 12, padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 8 }}>
              נתוני ממצאים נוספים
            </h2>
            <p style={{ color: 'var(--color-body)', fontSize: 14 }}>
              ממוצע יחידות דיור בכתובת: <strong>{avgUnits}</strong>
            </p>
          </div>
          <a href="/upload" style={btnPrimary}>העלאת דוח חדש</a>
        </div>
      </section>
    </AppLayout>
  )
}

const btnPrimary: React.CSSProperties = {
  display:      'inline-block',
  padding:      '14px 24px',
  background:   'var(--color-ink)',
  color:        '#fff',
  borderRadius: 12,
  fontSize:     16,
  fontWeight:   500,
  textDecoration: 'none',
  cursor:       'pointer',
  border:       'none',
  whiteSpace:   'nowrap',
}

const btnOnDark: React.CSSProperties = {
  display:        'inline-block',
  padding:        '12px 24px',
  background:     '#fff',
  color:          'var(--color-ink)',
  borderRadius:   12,
  fontSize:       16,
  fontWeight:     500,
  textDecoration: 'none',
  cursor:         'pointer',
}
