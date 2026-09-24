'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Send, Clock, ClipboardCheck, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { Card, StatCard, Badge, Table, Thead, Tbody, Tr, Th, Td, Spinner, EmptyState, CrossFilterBar } from '@/components/ui'
import { useCrossFilter, chartItemProps } from '@/lib/useCrossFilter'
import type { BadgeTone } from '@/components/ui'

const RESULT_LABELS: Record<string, string> = {
  'נמצא פער שטח + סיווג': 'פער שטח + סיווג',
  'נמצא פער בסיווג': 'פער בסיווג',
  'נמצא פער שטח': 'פער שטח',
  'לא נמצא עסק/פער שטח': 'לא נמצא עסק / פער',
}
const RESULT_COLORS: Record<string, string> = {
  'נמצא פער שטח + סיווג': '#c8102e',
  'נמצא פער בסיווג': '#c2410c',
  'נמצא פער שטח': '#a16207',
  'לא נמצא עסק/פער שטח': '#0f7a4a',
}
const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid' }

// Cross-filter dimension for the results donut — clicking a result narrows
// the KPIs and the pending table to properties with that result.
const SURVEY_DIMS = {
  result: (b: Business) => b.surveyResultDetail,
}
const DIM_LABELS = { result: 'ממצא' }

function computeStats(businesses: Business[]) {
  const sent = businesses.filter(b => b.sentToInspector === 'נשלח לסוקר')
  const reported = sent.filter(b => b.surveyResultDetail)
  const pending = sent.filter(b => !b.surveyResultDetail)
  const gapFound = reported.filter(b => b.surveyResultDetail !== 'לא נמצא עסק/פער שטח')
  const completionPct = sent.length > 0 ? Math.round((reported.length / sent.length) * 100) : 0
  const accuracyPct = reported.length > 0 ? Math.round((gapFound.length / reported.length) * 100) : 0

  const breakdown = new Map<string, number>()
  reported.forEach(b => {
    const key = b.surveyResultDetail as string
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1)
  })
  const resultSegments = [...breakdown.entries()]
    .map(([key, count]) => ({ key, count, label: RESULT_LABELS[key] ?? key, color: RESULT_COLORS[key] ?? '#7c8ba0' }))
    .sort((a, b) => b.count - a.count)

  return { sent, reported, pending, gapFound, completionPct, accuracyPct, resultSegments }
}

export default function SurveyTrackingPage() {
  const ready = useRequireRole(['employee', 'manager'])
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setBusinesses(cached)
      setLoading(false)
    }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const cf = useCrossFilter(businesses, SURVEY_DIMS)
  const stats = useMemo(() => computeStats(cf.filtered), [cf.filtered])
  // The donut ignores its own selection so all results stay visible, with
  // the picked one highlighted.
  const resultFiltered = cf.filteredExcept('result')
  const donut = useMemo(() => computeStats(resultFiltered), [resultFiltered])

  const arcs = donut.resultSegments.reduce<{ list: (typeof donut.resultSegments[number] & { pct: number; dashoffset: number })[]; offset: number }>(
    (acc, seg) => {
      const pct = donut.reported.length > 0 ? (seg.count / donut.reported.length) * 100 : 0
      acc.list.push({ ...seg, pct, dashoffset: -acc.offset })
      acc.offset += pct
      return acc
    },
    { list: [], offset: 0 }
  ).list

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="מעקב תוצאות סקר">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  return (
    <AppShell title="מעקב תוצאות סקר" subtitle="מה קרה עם הנכסים שנשלחו לשטח">
      <div className="flex flex-col gap-5">
        <CrossFilterBar cf={cf} dimLabels={DIM_LABELS} valueLabel={(_, v) => RESULT_LABELS[v] ?? v} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="נשלחו לסוקר"
            value={<span className="num">{stats.sent.length.toLocaleString('he')}</span>}
            icon={<Send size={16} className="text-subtle" strokeWidth={1.8} />}
          />
          <StatCard
            label="ממתינים לדיווח"
            value={<span className="num text-mid">{stats.pending.length.toLocaleString('he')}</span>}
            icon={<Clock size={16} className="text-subtle" strokeWidth={1.8} />}
          />
          <StatCard
            label="דווחו מהשטח"
            value={<span className="num">{stats.reported.length.toLocaleString('he')}</span>}
            icon={<ClipboardCheck size={16} className="text-subtle" strokeWidth={1.8} />}
            footer={<span className="text-[12px] text-subtle"><span className="num">{stats.completionPct}%</span> שיעור השלמה</span>}
          />
          <StatCard
            tone="brand"
            label="דיוק האינדיקציה"
            value={<span className="num">{stats.accuracyPct}%</span>}
            icon={<CheckCircle2 size={16} className="text-[#b9cdf7]" strokeWidth={1.8} />}
            footer={stats.reported.length > 0 && (
              <span className="text-[12px] text-[#a9c1f4]">
                <span className="num">{stats.gapFound.length}</span> מתוך <span className="num">{stats.reported.length}</span> חשדות אומתו בשטח
              </span>
            )}
          />
        </div>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14.5px] font-bold text-ink">פילוח ממצאי הסקר</span>
            <Link href="/businesses" className="text-[12.5px] font-semibold text-brand hover:text-brand-deep">כל הנכסים ←</Link>
          </div>
          {donut.reported.length === 0 ? (
            <EmptyState title="עדיין אין תוצאות סקר שדווחו" description="ברגע שסוקר ידווח ממצא, הפילוח יופיע כאן." />
          ) : (
            <div className="flex items-center gap-6 max-w-sm">
              <svg width="112" height="112" viewBox="0 0 42 42" className="shrink-0">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f3f6" strokeWidth="6.5" />
                {arcs.filter(a => a.pct > 0).map(arc => (
                  <circle
                    key={arc.key}
                    {...chartItemProps(cf, 'result', arc.key, `${arc.label}: ${arc.count}`)}
                    cx="21" cy="21" r="15.9" fill="none"
                    stroke={arc.color} strokeWidth="6.5"
                    strokeDasharray={`${arc.pct} ${100 - arc.pct}`}
                    strokeDashoffset={arc.dashoffset}
                    transform="rotate(-90 21 21)"
                  />
                ))}
                <text x="21" y="20.4" textAnchor="middle" style={{ font: "700 6px var(--font-num)", fill: '#0f1a28' }}>{donut.reported.length}</text>
                <text x="21" y="25" textAnchor="middle" style={{ font: "400 2.9px var(--font-sans)", fill: '#7c8ba0' }}>דיווחים</text>
              </svg>
              <div className="flex flex-col gap-2.5">
                {donut.resultSegments.map(seg => {
                  const item = chartItemProps(cf, 'result', seg.key, `${seg.label}: ${seg.count}`)
                  return (
                  <div key={seg.key} {...item} className={`${item.className} flex items-center gap-2.5 rounded px-1 -mx-1 ${item['aria-pressed'] ? 'bg-brand/[0.06]' : ''}`}>
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: seg.color }} />
                    <span className="text-[12.5px] text-charcoal">{seg.label}</span>
                    <span className="num text-[12.5px] font-bold text-ink">{seg.count}</span>
                  </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        <Card padded={false} className="flex-1 min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <span className="text-[14.5px] font-bold text-ink">תיקים פתוחים — ממתינים לדיווח</span>
            <span className="num text-[12.5px] text-subtle">{stats.pending.length}</span>
          </div>
          {stats.pending.length === 0 ? (
            <EmptyState title="אין תיקים פתוחים כרגע" description="כל הנכסים שנשלחו לסוקר קיבלו דיווח." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>נכס</Th>
                  <Th>שכונה</Th>
                  <Th>דירוג</Th>
                </Tr>
              </Thead>
              <Tbody>
                {stats.pending.map(b => (
                  <Tr key={b.id}>
                    <Td className="font-semibold">{b.name}</Td>
                    <Td className="text-charcoal">{b.neighborhood || '—'}</Td>
                    <Td><Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'}>{b.suspicionRating}</Badge></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
