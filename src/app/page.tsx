'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Flame, Send, ClipboardCheck, ArrowUpRight, TrendingUp, Upload, FileText, Download, HelpCircle } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import { useRole } from '@/lib/useRole'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, dbToBusiness, dbToSession } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { timeAgo, parseUploadDate } from '@/lib/dateUtils'
import { Card, StatCard, Button, Spinner, EmptyState, Pill, Sparkline } from '@/components/ui'

const RANGE_OPTIONS = [
  { label: '7 ימים', days: 7 },
  { label: '30 יום', days: 30 },
  { label: 'רבעון', days: 90 },
  { label: 'כלל הנתונים', days: Infinity },
] as const

function downloadBusinessesCsv(businesses: Business[], rangeLabel: string) {
  const headers = ['שם העסק', 'סוג', 'כתובת', 'שכונה', 'דירוג אינדיקציה', 'סטטוס סוקר', 'תוצאת סקר']
  const rows = businesses.map(b => [
    b.name, b.type, b.address, b.neighborhood, b.suspicionRating,
    b.sentToInspector ?? '', b.surveyResultDetail ?? '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `נכסים-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const ready = useRequireRole(['employee', 'manager'])
  const role = useRole()
  const canEdit = role === 'employee'
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions, setSessions] = useState<UploadSession[]>([])
  const [loading, setLoading] = useState(true)
  const [rangeDays, setRangeDays] = useState<number>(Infinity)
  // Captured once per page load rather than read fresh on every render —
  // avoids calling the impure Date.now() during render, and a dashboard
  // doesn't need to reclassify "in range" mid-session anyway.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    const cachedB = getCache<Business[]>('businesses')
    const cachedS = getCache<UploadSession[]>('sessions')
    if (cachedB && cachedS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setBusinesses(cachedB)
      setSessions(cachedS)
      setLoading(false)
    }
    Promise.all([
      supabase.from('businesses').select('*'),
      supabase.from('upload_sessions').select('*'),
    ]).then(([{ data: bData }, { data: sData }]) => {
      if (bData) { const b = bData.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      if (sData) { const s = sData.map(dbToSession); setSessions(s); setCache('sessions', s) }
      setLoading(false)
    })
  }, [])

  // The range control is meant to actually filter the whole page, not just
  // one footer line — so every metric below is computed from this
  // range-scoped set, not from the full `businesses` array.
  const businessesInRange = useMemo(() => {
    // "כלל הנתונים" must mean literally everything, regardless of whether a
    // given record's upload date happens to be parseable — otherwise a
    // handful of legacy-format dates would silently disappear even here.
    if (rangeDays === Infinity) return businesses
    const cutoff = now - rangeDays * 86400000
    return businesses.filter(b => {
      const d = parseUploadDate(b.uploadDate)
      return d !== null && d.getTime() >= cutoff
    })
  }, [businesses, rangeDays, now])

  const stats = useMemo(() => {
    const total = businessesInRange.length
    const byRating = (r: string) => businessesInRange.filter(b => b.suspicionRating === r).length
    const high = byRating('גבוה')
    const mid = byRating('בינוני')
    const indication = high + mid

    const sent = businessesInRange.filter(b => b.sentToInspector === 'נשלח לסוקר')
    const declined = businessesInRange.filter(b => b.sentToInspector === 'הוחלט לא לשלוח לסקר')
    const reported = sent.filter(b => b.surveyResultDetail)
    const gapFound = reported.filter(b => b.surveyResultDetail !== 'לא נמצא עסק/פער שטח')
    const pendingAssignment = businessesInRange.filter(b =>
      (b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני') &&
      b.sentToInspector !== 'נשלח לסוקר' && b.sentToInspector !== 'הוחלט לא לשלוח לסקר'
    )

    // The workflow only ever acts on 'גבוה' properties going forward, so a
    // breakdown of survey-pipeline stage (of those) is the meaningful
    // "distribution" chart here — a rating breakdown would just be one
    // giant slice forever. Real fields, no invented categories.
    const highIndication = businessesInRange.filter(b => b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני')
    const notSentYet = highIndication.filter(b => b.sentToInspector !== 'נשלח לסוקר')
    const awaitingReport = sent.filter(b => !b.surveyResultDetail)
    const noGap = reported.filter(b => b.surveyResultDetail === 'לא נמצא עסק/פער שטח')

    // Raw count per neighborhood — not a rate. With only one indication
    // tier in real use, "% of neighborhood that's high" degenerates to a
    // meaningless ~100% everywhere; a plain count still tells you where
    // the actionable properties actually are.
    const byNeighborhood = new Map<string, number>()
    highIndication.forEach(b => {
      if (!b.neighborhood) return
      byNeighborhood.set(b.neighborhood, (byNeighborhood.get(b.neighborhood) ?? 0) + 1)
    })
    const hotNeighborhoods = [...byNeighborhood.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    const topThreeShare = indication > 0
      ? Math.round((hotNeighborhoods.slice(0, 3).reduce((sum, n) => sum + n.count, 0) / indication) * 100)
      : 0

    // Cumulative history from each business's own upload date — a real
    // series (not an invented ±% trend) usable for the KPI sparklines.
    const byDay = new Map<string, { total: number; indication: number }>()
    businessesInRange.forEach(b => {
      const parsed = parseUploadDate(b.uploadDate)
      if (!parsed) return
      const day = parsed.toISOString().slice(0, 10)
      const entry = byDay.get(day) ?? { total: 0, indication: 0 }
      entry.total += 1
      if (b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני') entry.indication += 1
      byDay.set(day, entry)
    })
    const sortedDays = [...byDay.keys()].sort()
    let runningTotal = 0
    let runningIndication = 0
    const totalHistory: number[] = []
    const indicationHistory: number[] = []
    sortedDays.forEach(day => {
      const e = byDay.get(day)!
      runningTotal += e.total
      runningIndication += e.indication
      totalHistory.push(runningTotal)
      indicationHistory.push(runningIndication)
    })

    return {
      total, high, mid, indication,
      sent, declined, reported, gapFound, pendingAssignment,
      notSentYet, awaitingReport, noGap,
      hotNeighborhoods, topThreeShare, totalHistory, indicationHistory,
    }
  }, [businessesInRange])

  const lastUpdated = useMemo(() => {
    const timestamps = sessions.map(s => parseUploadDate(s.uploadDate)?.getTime()).filter((t): t is number => t !== undefined)
    return timestamps.length ? timeAgo(new Date(Math.max(...timestamps)).toISOString()) : null
  }, [sessions])

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => (parseUploadDate(b.uploadDate)?.getTime() ?? 0) - (parseUploadDate(a.uploadDate)?.getTime() ?? 0)).slice(0, 5),
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

  if (businesses.length === 0) {
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

  const rangeLabel = RANGE_OPTIONS.find(o => o.days === rangeDays)?.label ?? ''

  const funnelStages = [
    { label: 'נסרקו', value: stats.total, tone: 'brand' as const },
    { label: 'אינדיקציה', value: stats.indication, tone: 'brand' as const },
    { label: 'נשלחו לסוקר', value: stats.sent.length, tone: 'brand' as const },
    { label: 'דווח מהשטח', value: stats.reported.length, tone: 'brand' as const },
    { label: 'נמצא פער', value: stats.gapFound.length, tone: 'clear' as const },
  ]
  const funnelMax = Math.max(stats.total, 1)

  // Survey-pipeline breakdown of the high-indication properties in range —
  // real, varied, and relevant now that "rating" itself is no longer a
  // meaningful axis (every property this team works is 'גבוה').
  const pipelineSegments = [
    { key: 'notSent', label: 'טרם נשלח לסוקר', count: stats.notSentYet.length, color: '#7c8ba0' },
    { key: 'awaiting', label: 'נשלח, ממתין לדיווח', count: stats.awaitingReport.length, color: '#296ef9' },
    { key: 'noGap', label: 'דווח, לא נמצא פער', count: stats.noGap.length, color: '#0f7a4a' },
    { key: 'gap', label: 'דווח, נמצא פער', count: stats.gapFound.length, color: '#c8102e' },
  ]
  const pipelineTotal = pipelineSegments.reduce((sum, s) => sum + s.count, 0)
  const pipelineArcs = pipelineSegments.reduce<{ list: (typeof pipelineSegments[number] & { pct: number; dashoffset: number })[]; offset: number }>(
    (acc, seg) => {
      const pct = pipelineTotal > 0 ? (seg.count / pipelineTotal) * 100 : 0
      acc.list.push({ ...seg, pct, dashoffset: -acc.offset })
      acc.offset += pct
      return acc
    },
    { list: [], offset: 0 }
  ).list

  return (
    <AppShell
      title="מרכז בקרה"
      subtitle={lastUpdated ? `עודכן ${lastUpdated} · נתוני אמת מ-Supabase` : 'נתוני אמת מ-Supabase'}
      actions={
        <>
          <div className="flex bg-canvas rounded-lg p-0.5 gap-0.5">
            {RANGE_OPTIONS.map(opt => (
              <Pill key={opt.days} active={rangeDays === opt.days} onClick={() => setRangeDays(opt.days)}>
                {opt.label}
              </Pill>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" icon={<Download size={15} strokeWidth={1.9} />} onClick={() => downloadBusinessesCsv(businessesInRange, rangeLabel)}>
              ייצוא דוח
            </Button>
            <span
              className="text-subtle cursor-help"
              title={`הקובץ יכלול את ${stats.total.toLocaleString('he')} הנכסים המוצגים כרגע בדשבורד (מסוננים לפי "${rangeLabel}" שנבחר למעלה): שם, סוג, כתובת, שכונה, דירוג אינדיקציה, סטטוס סוקר ותוצאת סקר.`}
            >
              <HelpCircle size={16} strokeWidth={1.8} />
            </span>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">

        {/* KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="נכסים במעקב"
            value={<span className="num">{stats.total.toLocaleString('he')}</span>}
            icon={<Building2 size={16} className="text-subtle" strokeWidth={1.8} />}
            sparkline={<Sparkline values={stats.totalHistory} color="#296ef9" />}
            footer={businesses.length !== stats.total && (
              <div className="flex items-center gap-1 text-[12px] text-subtle">
                <ArrowUpRight size={13} strokeWidth={2.4} className="text-clear" />
                <span>מתוך <span className="num font-semibold text-charcoal">{businesses.length.toLocaleString('he')}</span> סה״כ במערכת</span>
              </div>
            )}
          />
          <StatCard
            label="אינדיקציה גבוהה"
            value={<span className="num text-high">{stats.high.toLocaleString('he')}</span>}
            icon={<span className="w-1.5 h-1.5 rounded-full bg-high" />}
            sparkline={<Sparkline values={stats.indicationHistory} color="#c8102e" />}
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
            tone="brand"
            label="אימות בשטח"
            icon={<ClipboardCheck size={16} className="text-[#b9cdf7]" strokeWidth={1.8} />}
            value={
              <span className="flex items-baseline gap-1.5">
                <span className="num">{stats.sent.length > 0 ? Math.round((stats.reported.length / stats.sent.length) * 100) : 0}%</span>
                <span className="num text-[12.5px] text-[#a9c1f4] font-normal">{stats.reported.length} מתוך {stats.sent.length} דיווחים</span>
              </span>
            }
            footer={
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden flex w-36">
                <span
                  className="bg-white block h-full"
                  style={{ width: `${stats.sent.length > 0 ? (stats.reported.length / stats.sent.length) * 100 : 0}%` }}
                />
              </div>
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
              <p className="text-sm text-graphite py-6">אין עדיין נכסים עם אינדיקציה משויכים לשכונה בטווח שנבחר.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.hotNeighborhoods.map(n => {
                  const max = stats.hotNeighborhoods[0].count
                  return (
                    <div key={n.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[13px] font-semibold text-ink truncate">{n.name}</span>
                      {/* A plain block width aligns to the row's own start edge (right,
                          under RTL) by default — bars read the same direction as the
                          text around them, growing from the right like the label does. */}
                      <div className="flex-1 h-[22px] bg-canvas rounded-md overflow-hidden">
                        <span
                          className="block h-full rounded-md min-w-[10px]"
                          style={{ width: `${(n.count / max) * 100}%`, background: 'linear-gradient(90deg, #a9c8ff 0%, #024ad8 100%)' }}
                        />
                      </div>
                      <span className="num w-8 shrink-0 text-start text-[13px] font-bold text-brand">{n.count}</span>
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
              <div className="text-[14.5px] font-bold text-ink mb-3">פילוח סקר — נכסים באינדיקציה</div>
              <div className="flex items-center gap-4">
                <svg width="104" height="104" viewBox="0 0 42 42" className="shrink-0">
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f3f6" strokeWidth="6" />
                  {pipelineArcs.filter(a => a.pct > 0).map(arc => (
                    <circle
                      key={arc.key}
                      cx="21" cy="21" r="15.9" fill="none"
                      stroke={arc.color} strokeWidth="6"
                      strokeDasharray={`${arc.pct} ${100 - arc.pct}`}
                      strokeDashoffset={arc.dashoffset}
                      transform="rotate(-90 21 21)"
                    />
                  ))}
                  <text x="21" y="20.4" textAnchor="middle" style={{ font: "700 6px var(--font-num)", fill: '#0f1a28' }}>{pipelineTotal}</text>
                  <text x="21" y="25" textAnchor="middle" style={{ font: "400 2.9px var(--font-sans)", fill: '#7c8ba0' }}>נכסים</text>
                </svg>
                <div className="flex flex-col gap-2">
                  {pipelineSegments.map(seg => (
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
