'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Business } from '@/lib/types'

const RATING_CLASS: Record<string, string> = {
  'גבוה':        'bg-red-100 text-red-700',
  'בינוני':      'bg-orange-100 text-orange-700',
  'לא חשוד':    'bg-green-100 text-green-700',
  'דרוש בדיקה': 'bg-yellow-100 text-yellow-700',
}

export default function Dashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'suspicious' | 'ok' | 'unknown'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('businesses')
    if (stored) setBusinesses(JSON.parse(stored))
  }, [])

  const filtered = businesses.filter((b) => {
    const matchSearch =
      b.name.includes(search) ||
      b.address.includes(search) ||
      b.type.includes(search)
    const matchFilter = filter === 'all' || b.arnonaStatus === filter
    return matchSearch && matchFilter
  })

  const stats = {
    total:      businesses.length,
    suspicious: businesses.filter((b) => b.arnonaStatus === 'suspicious').length,
    ok:         businesses.filter((b) => b.arnonaStatus === 'ok').length,
    unknown:    businesses.filter((b) => b.arnonaStatus === 'unknown').length,
  }

  function clearAll() {
    if (confirm('למחוק את כל הנתונים?')) {
      localStorage.removeItem('businesses')
      setBusinesses([])
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סוכן ארנונה</h1>
          <p className="text-sm text-gray-500">זיהוי עסקים החשודים בתשלום ארנונת מגורים — עיריית ירושלים</p>
        </div>
        <div className="flex gap-2">
          {businesses.length > 0 && (
            <button onClick={clearAll} className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
              נקה הכל
            </button>
          )}
          <Link href="/upload" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + העלה דוח יומי
          </Link>
        </div>
      </div>

      {/* Stats */}
      {businesses.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="סה״כ עסקים"  value={stats.total}      color="blue"  onClick={() => setFilter('all')}        active={filter === 'all'} />
          <StatCard label="חשודים"       value={stats.suspicious} color="red"   onClick={() => setFilter('suspicious')} active={filter === 'suspicious'} />
          <StatCard label="לא חשודים"   value={stats.ok}         color="green" onClick={() => setFilter('ok')}         active={filter === 'ok'} />
          <StatCard label="דרוש בדיקה"  value={stats.unknown}    color="yellow" onClick={() => setFilter('unknown')}   active={filter === 'unknown'} />
        </div>
      )}

      {/* Search */}
      {businesses.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="חיפוש לפי שם, כתובת או סוג עסק..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Empty state */}
      {businesses.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📂</p>
          <p className="text-lg font-medium text-gray-600">אין נתונים עדיין</p>
          <p className="text-sm mt-1">העלה דוח אקסל יומי כדי להתחיל</p>
          <Link href="/upload" className="mt-4 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            העלה עכשיו
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-6 px-3 py-3"></th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">שם העסק</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">סוג עסק</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">כתובת</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">דירוג חשד</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">יחידות</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">תאריך</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => (
                <>
                  <tr
                    key={b.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  >
                    <td className="px-3 py-3 text-gray-400 text-xs">{expanded === b.id ? '▾' : '▸'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-4 py-3 text-gray-500">{b.type}</td>
                    <td className="px-4 py-3 text-gray-600">{b.address}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${RATING_CLASS[b.suspicionRating] ?? 'bg-gray-100 text-gray-500'}`}>
                        {b.suspicionRating || 'לא ידוע'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.unitCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{b.uploadDate}</td>
                  </tr>
                  {expanded === b.id && (
                    <tr key={`${b.id}-detail`} className="bg-blue-50">
                      <td colSpan={7} className="px-6 py-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          {b.matchedAddress && (
                            <div>
                              <span className="font-medium text-gray-600">כתובת תואמת: </span>
                              <span className="text-gray-800">{b.matchedAddress}</span>
                            </div>
                          )}
                          {b.suspicionDetail && (
                            <div>
                              <span className="font-medium text-gray-600">פירוט החשד: </span>
                              <span className="text-gray-800">{b.suspicionDetail}</span>
                            </div>
                          )}
                          {b.noSuspicionReason && (
                            <div>
                              <span className="font-medium text-gray-600">סיבת אי-חשד: </span>
                              <span className="text-gray-800">{b.noSuspicionReason}</span>
                            </div>
                          )}
                          {b.propertyOwners && (
                            <div className="col-span-2">
                              <span className="font-medium text-gray-600">בעלי נכסים: </span>
                              <span className="text-gray-800">{b.propertyOwners}</span>
                            </div>
                          )}
                          {b.link && (
                            <div>
                              <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                קישור למקור
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">לא נמצאו תוצאות</div>
          )}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
            מציג {filtered.length} מתוך {businesses.length} עסקים
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string; onClick: () => void; active: boolean
}) {
  const colors: Record<string, string> = {
    blue:   'border-blue-200 bg-blue-50 text-blue-700',
    red:    'border-red-200 bg-red-50 text-red-700',
    green:  'border-green-200 bg-green-50 text-green-700',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-right w-full transition-all ${colors[color]} ${active ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:opacity-80'}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </button>
  )
}
