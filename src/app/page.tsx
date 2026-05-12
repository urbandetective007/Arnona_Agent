'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business, UploadSession } from '@/lib/types'

const RATING_COLOR: Record<string, string> = {
  'גבוה':        'bg-red-500',
  'בינוני':      'bg-orange-400',
  'לא חשוד':    'bg-green-500',
  'דרוש בדיקה': 'bg-yellow-400',
}
const RATING_TEXT: Record<string, string> = {
  'גבוה':        'text-red-700 bg-red-100',
  'בינוני':      'text-orange-700 bg-orange-100',
  'לא חשוד':    'text-green-700 bg-green-100',
  'דרוש בדיקה': 'text-yellow-700 bg-yellow-100',
}

export default function Dashboard() {
  const ready = useRequireAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions, setSessions] = useState<UploadSession[]>([])

  useEffect(() => {
    const b = localStorage.getItem('businesses')
    const s = localStorage.getItem('uploadSessions')
    if (b) setBusinesses(JSON.parse(b))
    if (s) setSessions(JSON.parse(s))
  }, [])

  if (!ready) return null

  const total = businesses.length

  // Suspicion rating counts
  const ratingCounts = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד'].map((r) => ({
    label: r,
    count: businesses.filter((b) => b.suspicionRating === r).length,
  }))
  const maxRating = Math.max(...ratingCounts.map((r) => r.count), 1)

  // Top business types
  const typeMap: Record<string, number> = {}
  businesses.forEach((b) => { if (b.type) typeMap[b.type] = (typeMap[b.type] || 0) + 1 })
  const topTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxType = Math.max(...topTypes.map((t) => t[1]), 1)

  // Suspicion rate
  const suspiciousCount = businesses.filter((b) => b.suspicionRating === 'גבוה' || b.suspicionRating === 'בינוני').length
  const suspicionRate = total > 0 ? Math.round((suspiciousCount / total) * 100) : 0

  // Last session
  const lastSession = sessions.at(-1)

  // Unit counts (only numeric)
  const unitNums = businesses
    .map((b) => parseInt(b.unitCount))
    .filter((n) => !isNaN(n))
  const avgUnits = unitNums.length > 0 ? (unitNums.reduce((a, b) => a + b, 0) / unitNums.length).toFixed(1) : '—'
  const maxUnits = unitNums.length > 0 ? Math.max(...unitNums) : '—'

  if (total === 0) {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-lg font-medium text-gray-600">אין נתונים להצגה</p>
          <p className="text-sm mt-1">העלה דוח יומי כדי לראות סטטיסטיקות</p>
          <a href="/upload" className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            העלה עכשיו
          </a>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-sm text-gray-500">סטטיסטיקות על בסיס {total} עסקים במערכת</p>
        </div>

        {/* Top cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card title="סה״כ עסקים" value={total} sub="במערכת" color="blue" />
          <Card title="חשד גבוה" value={ratingCounts.find(r => r.label === 'גבוה')?.count ?? 0} sub="עסקים" color="red" />
          <Card title="שיעור חשד" value={`${suspicionRate}%`} sub="מהעסקים חשודים" color="orange" />
          <Card title="קבצים שהועלו" value={sessions.length} sub="מאז ההתחלה" color="purple" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Suspicion distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">התפלגות דירוג חשד</h2>
            <div className="space-y-3">
              {ratingCounts.map(({ label, count }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RATING_TEXT[label]}`}>{label}</span>
                    <span className="text-gray-500">{count} ({total > 0 ? Math.round(count/total*100) : 0}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${RATING_COLOR[label] ?? 'bg-gray-400'}`}
                      style={{ width: `${(count / maxRating) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top business types */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">סוגי עסקים נפוצים</h2>
            <div className="space-y-3">
              {topTypes.map(([type, count]) => (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate max-w-[200px]">{type}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${(count / maxType) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Unit stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">נתוני יחידות דיור</h2>
            <div className="space-y-3">
              <StatRow label="ממוצע יחידות בכתובת" value={avgUnits} />
              <StatRow label="מקסימום יחידות" value={String(maxUnits)} />
              <StatRow label="עסקים עם נתון ידוע" value={String(unitNums.length)} />
            </div>
          </div>

          {/* Last upload info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">העלאה אחרונה</h2>
            {lastSession ? (
              <div className="space-y-3">
                <StatRow label="קובץ" value={lastSession.fileName} />
                <StatRow label="תאריך" value={lastSession.uploadDate} />
                <StatRow label="סה״כ עסקים" value={String(lastSession.totalCount)} />
                <StatRow label="חשודים" value={String(lastSession.suspiciousCount)} />
              </div>
            ) : (
              <p className="text-sm text-gray-400">אין מידע על קבצים קודמים</p>
            )}
          </div>

          {/* Suspicion breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">פירוט חשד</h2>
            <div className="space-y-3">
              <StatRow label="חשד גבוה" value={String(ratingCounts.find(r=>r.label==='גבוה')?.count ?? 0)} />
              <StatRow label="חשד בינוני" value={String(ratingCounts.find(r=>r.label==='בינוני')?.count ?? 0)} />
              <StatRow label="דרוש בדיקה" value={String(ratingCounts.find(r=>r.label==='דרוש בדיקה')?.count ?? 0)} />
              <StatRow label="לא חשוד" value={String(ratingCounts.find(r=>r.label==='לא חשוד')?.count ?? 0)} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Card({ title, value, sub, color }: { title: string; value: string | number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue:   'border-blue-100 bg-blue-50 text-blue-700',
    red:    'border-red-100 bg-red-50 text-red-700',
    orange: 'border-orange-100 bg-orange-50 text-orange-700',
    purple: 'border-purple-100 bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-xs mt-1 opacity-60">{sub}</p>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}
