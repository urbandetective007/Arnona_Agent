'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Flame, Send, ClipboardCheck, ArrowUpRight, TrendingUp, Upload, FileText } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import { useRole } from '@/lib/useRole'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, dbToBusiness, dbToSession } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { timeAgo } from '@/lib/dateUtils'
import { Card, StatCard, Button, Spinner, EmptyState } from '@/components/ui'

export default function Dashboard() {
  const ready = useRequireRole(['employee', 'manager'])
  const role = useRole()
  const canEdit = role === 'employee'
  const [businesses, setBusinesses] = useState<Business[]>(() => getCache<Business[]>('businesses') ?? [])
  const [sessions, setSessions] = useState<UploadSession[]>(() => getCache<UploadSession[]>('sessions') ?? [])
  const [loading, setLoading] = useState(() => !(getCache<Business[]>('businesses') && getCache<UploadSession[]>('sessions')))

  useEffect(() => {
    Promise.all([
      supabase.from('businesses').select('*'),
      supabase.from('upload_sessions').select('*'),
    ]).then(([{ data: bData }, { data: sData }]) => {
      if (bData) { const b = bData.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      if (sData) { const s = sData.map(dbToSession); setSessions(s); setCache('sessions', s) }
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => {
    const total = businesses.length
    const byRating = (r: string) => businesses.filter(b => b.suspicionRating === r).length
    const high = byRating('גבוה')
    const mid = byRating('בינוני')
    const needsCheck = byRating('דרוש בדיקה')
    const notSuspect = byRating('לא חשוד')
    const indication = high + mid

    const sent = businesses.filter(b => b.sentToInspector === 'נשלח לסוקר')
    const declined = businesses.filter(b => b.sentToInspector === 'הוחלט לא לשלוח לסקר')
    const reported = sent.filter(b => b.surveyResultDetail)
    const gapFound = reported.filter(b => b.surveyResultDetail !== 'לא נמצא עסק/פער שטח')
    const pendingAssignment = businesses.filter(b =>
      (b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני') &&
      b.sentToInspector !== 'נשלח לסוקר' && b.sentToInspector !== 'הוחלט לא לשלוח לסקר'
    )

    const now = new Date()
    const addedThisMonth = businesses.filter(b => {
      const d = new Date(b.uploadDate)
      return !Number.isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    const byNeighborhood = new Map<string, number>()
    businesses.forEach(b => {
      if (!b.neighborhood) return
      if (b.suspicionRating !== 'גבוה' && b.suspicionRating !== 'בינוני') return
      byNeighborhood.set(b.neighborhood, (byNeighborhood.get(b.neighborhood) ?? 0) + 1)
    })
    const hotNeighborhoods = [...byNeighborhood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const topThreeShare = indication > 0
      ? Math.round((hotNeighborhoods.slice(0, 3).reduce((sum, [, c]) => sum + c, 0) / indication) * 100)
      : 0

    return {
      total, high, mid, needsCheck, notSuspect, indication,
      sent, declined, reported, gapFound, pendingAssignment,
      addedThisMonth, hotNeighborhoods, topThreeShare,
    }
  }, [businesses])

  const lastUpdated = useMemo(() => {
    const dates = sessions.map(s => s.uploadDate).filter(Boolean).sort()
    return dates.length ? timeAgo(dates[dates.length - 1]) : null
  }, [sessions])

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => (a.uploadDate < b.uploadDate ? 1 : -1)).slice(0, 5),
    [sessions]
  )

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="מרכז בקרה">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  if (stats.total === 0) {
    return (
      <AppShell title="מרכז בקרה" subtitle="נתוני אמת מ-Supabase">
        <Card>
          <EmptyState
            icon={<Building2 size={40} strokeWidth={1.5} />}
            title="אין עדיין נתונים במערכת"
            description={canEdit ? 'העלה דוח יומי כדי להתחיל לעקוב אחרי נכסים.' : undefined}
            action={canEdit ? <Button href="/upload">העלאת דוח חדש</Button> : undefined}
          />
        </Card>
      </AppShell>
    )
  }

  const funnelStages = [
    { label: 'נסרקו', value: stats.total, tone: 'brand' as const },
    { label: 'אינדיקציה', value: stats.indication, tone: 'brand' as const },
    { label: 'נשלחו לסוקר', value: stats.sent.length, tone: 'brand' as const },
    { label: 'דווח מהשטח', value: stats.reported.length, tone: 'brand' as const },
    { label: 'נמצא פער', value: stats.gapFound.length, tone: 'clear' as const },
  ]
  const funnelMax = Math.max(stats.total, 1)

  const donutSegments = [
    { key: 'high', label: 'גבוה', count: stats.high, color: '#c8102e' },
    { key: 'mid', label: 'בינוני', count: stats.mid, color: '#c2410c' },
    { key: 'check', label: 'דרוש בדיקה', count: stats.needsCheck, color: '#7c8ba0' },
    { key: 'clear', label: 'לא חשוד', count: stats.notSuspect, color: '#0f7a4a' },
  ]
  const circumference = 100
  let offset = 0
  const donutArcs = donutSegments.map(seg => {
    const pct = stats.total > 0 ? (seg.count / stats.total) * circumference : 0
    const arc = { ...seg, pct, dashoffset: -offset }
    offset += pct
    return arc
  })

  return (
    <AppShell
      title="מרכז בקרה"
      subtitle={lastUpdated ? `עודכן ${lastUpdated} · נתוני אמת מ-Supabase` : 'נתוני אמת מ-Supabase'}
    >
      <div className="flex flex-col gap-5">

        {/* KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="נכסים במעקב"
            value={<span className="num">{stats.total.toLocaleString('he')}</span>}
            icon={<Building2 size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={stats.addedThisMonth > 0 && (
              <div className="flex items-center gap-1 text-[12px] text-clear font-semibold">
                <ArrowUpRight size={13} strokeWidth={2.4} />
                <span className="num">{stats.addedThisMonth}</span>
                <span className="text-subtle font-normal">החודש</span>
              </div>
            )}
          />
          <StatCard
            label="אינדיקציה גבוהה"
            value={<span className="num text-high">{stats.high.toLocaleString('he')}</span>}
            icon={<span className="w-1.5 h-1.5 rounded-full bg-high" />}
            footer={
              <span className="text-[12px] text-subtle">
                <span className="num">{stats.total > 0 ? Math.round((stats.high / stats.total) * 100) : 0}%</span> מכלל הנכסים
              </span>
            }
          />
          <StatCard
            label="נשלחו לסוקר"
            value={<span className="num">{stats.sent.length.toLocaleString('he')}</span>}
            icon={<Send size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={
              <span className="text-[12px] text-subtle">
                <span className="num">{stats.pendingAssignment.length}</span> באינדיקציה עדיין לא הוקצו
              </span>
            }
          />
          <StatCard
            label="אימות בשטח"
            value={
              <span className="flex items-baseline gap-1.5">
                <span className="num">{stats.sent.length > 0 ? Math.round((stats.reported.length / stats.sent.length) * 100) : 0}%</span>
                <span className="num text-[12.5px] text-subtle font-normal">{stats.reported.length} מתוך {stats.sent.length} דיווחים</span>
              </span>
            }
            icon={<ClipboardCheck size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={
              <>
                <div className="h-1.5 bg-canvas rounded-full overflow-hidden flex">
                  <span
                    className="bg-clear block h-full"
                    style={{ width: `${stats.sent.length > 0 ? (stats.reported.length / stats.sent.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-[11.5px] text-graphite mt-1.5">שיעור הדיווחים שהתקבלו מהסוקר</div>
              </>
            }
          />
        </div>

        {/* FUNNEL */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[14.5px] font-bold text-ink">משפך האכיפה</span>
              <span className="text-xs text-subtle">מסריקה ועד גביית פער</span>
            </div>
            <Link href="/survey-tracking" className="text-[12.5px] font-semibold text-brand hover:text-brand-deep">פירוט מלא ←</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {funnelStages.map(stage => (
              <div
                key={stage.label}
                className={`rounded-[10px] p-3 border ${stage.tone === 'clear' ? 'bg-clear/[0.06] border-clear/25' : 'bg-canvas border-[#e8edf4]'}`}
              >
                <div className={`text-xs font-semibold ${stage.tone === 'clear' ? 'text-clear' : 'text-graphite'}`}>{stage.label}</div>
                <div className={`num text-2xl font-bold mt-1 ${stage.tone === 'clear' ? 'text-clear' : 'text-ink'}`}>{stage.value}</div>
                <div className={`h-1 rounded-full mt-2.5 overflow-hidden ${stage.tone === 'clear' ? 'bg-clear/20' : 'bg-[#eef1f5]'}`}>
                  <span
                    className={`block h-full ${stage.tone === 'clear' ? 'bg-clear' : 'bg-brand-light'}`}
                    style={{ width: `${(stage.value / funnelMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {stats.pendingAssignment.length > 0 && (
            <div className="mt-3.5 p-2.5 px-3.5 bg-mid/[0.06] border border-mid/25 rounded-[9px] flex items-center gap-2.5 flex-wrap">
              <TrendingUp size={17} className="text-mid shrink-0" strokeWidth={1.9} />
              <span className="text-[13px] text-[#7c3a12]">
                <strong className="font-bold">צוואר בקבוק:</strong>{' '}
                <span className="num">{stats.pendingAssignment.length}</span> נכסים באינדיקציה מחכים להקצאה לסוקר.
              </span>
              {canEdit && (
                <Link href="/businesses" className="me-auto text-[12.5px] font-semibold text-mid hover:underline">הקצה עכשיו ←</Link>
              )}
            </div>
          )}
        </Card>

        {/* TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">

          {/* Hot neighborhoods */}
          <Card className="flex flex-col">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[14.5px] font-bold text-ink">שכונות חמות</span>
              <span className="text-[11.5px] text-graphite">לפי מספר נכסים באינדיקציה</span>
            </div>
            {stats.hotNeighborhoods.length === 0 ? (
              <p className="text-sm text-graphite py-6">אין עדיין נכסים עם אינדיקציה משויכים לשכונה.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.hotNeighborhoods.map(([name, count]) => {
                  const max = stats.hotNeighborhoods[0][1]
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[13px] font-semibold text-ink truncate">{name}</span>
                      {/* justify-end anchors the bar to the same side as the count, so a
                          short bar still sits next to its number instead of stranding it
                          across an empty track. */}
                      <div className="flex-1 h-[22px] bg-canvas rounded-md overflow-hidden flex justify-end">
                        <span
                          className="block h-full rounded-md min-w-[10px]"
                          style={{ width: `${(count / max) * 100}%`, background: 'linear-gradient(90deg, #c8102e 0%, #e04a5f 100%)' }}
                        />
                      </div>
                      <span className="num w-8 shrink-0 text-start text-[13px] font-bold text-high">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {stats.hotNeighborhoods.length >= 3 && (
              <div className="mt-auto pt-3.5 border-t border-[#eef1f5] flex items-center gap-2">
                <Flame size={15} className="text-brand shrink-0" strokeWidth={1.9} />
                <span className="text-[12.5px] text-charcoal">
                  3 השכונות המובילות מרכזות <strong className="font-semibold num">{stats.topThreeShare}%</strong> מכלל הנכסים באינדיקציה.
                </span>
              </div>
            )}
          </Card>

          {/* Donut + activity */}
          <div className="flex flex-col gap-5 min-h-0">
            <Card>
              <div className="text-[14.5px] font-bold text-ink mb-3">התפלגות דירוג</div>
              <div className="flex items-center gap-4">
                <svg width="104" height="104" viewBox="0 0 42 42" className="shrink-0">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f3f6" strokeWidth="6" />
                  {donutArcs.filter(a => a.pct > 0).map(arc => (
                    <circle
                      key={arc.key}
                      cx="21" cy="21" r="15.9" fill="none"
                      stroke={arc.color} strokeWidth="6"
                      strokeDasharray={`${arc.pct} ${100 - arc.pct}`}
                      strokeDashoffset={arc.dashoffset}
                      transform="rotate(-90 21 21)"
                    />
                  ))}
                  <text x="21" y="20.4" textAnchor="middle" style={{ font: "700 6px var(--font-num)", fill: '#0f1a28' }}>{stats.total}</text>
                  <text x="21" y="25" textAnchor="middle" style={{ font: "400 2.9px var(--font-sans)", fill: '#7c8ba0' }}>נכסים</text>
                </svg>
                <div className="flex flex-col gap-2">
                  {donutSegments.map(seg => (
                    <div key={seg.key} className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: seg.color }} />
                      <span className="text-[12.5px] text-charcoal">{seg.label}</span>
                      <span className="num text-[12.5px] font-bold text-ink">{seg.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="flex-1 min-h-0">
              <div className="text-[14.5px] font-bold text-ink mb-3">פעילות אחרונה</div>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-graphite">אין עדיין דוחות שהועלו.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {recentSessions.map(s => (
                    <div key={s.id} className="flex gap-2.5">
                      <span className="w-[26px] h-[26px] rounded-[7px] bg-brand/10 flex items-center justify-center shrink-0">
                        <FileText size={14} className="text-brand" strokeWidth={2.1} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] leading-snug text-ink">
                          נוספו <strong className="font-semibold num">{s.totalCount}</strong> נכסים מהקובץ <span className="font-medium">{s.fileName}</span>
                        </div>
                        <div className="text-[11px] text-subtle mt-0.5">{timeAgo(s.uploadDate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {canEdit && (
          <div
            className="rounded-xl p-5 flex items-center justify-between gap-6 flex-wrap"
            style={{ background: 'linear-gradient(180deg, var(--color-chrome) 0%, var(--color-chrome-deep) 100%)' }}
          >
            <div>
              <div className="text-white font-bold text-base">מוכן להעלאת דוח חדש?</div>
              <div className="flex items-center gap-1.5 text-chrome-graphite text-sm mt-1">
                <Upload size={13} strokeWidth={2} />
                הוסף נתונים חדשים למערכת בקלות
              </div>
            </div>
            <Button href="/upload" variant="onDark" className="shrink-0">העלאת דוח חדש</Button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
