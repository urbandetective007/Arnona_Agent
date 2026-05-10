'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Business } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  suspicious: 'חשוד',
  ok: 'תקין',
  unknown: 'לא ידוע',
}

const STATUS_CLASS: Record<string, string> = {
  suspicious: 'bg-red-100 text-red-800',
  ok: 'bg-green-100 text-green-800',
  unknown: 'bg-gray-100 text-gray-600',
}

export default function Dashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'suspicious' | 'ok' | 'unknown'>('all')

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
    total: businesses.length,
    suspicious: businesses.filter((b) => b.arnonaStatus === 'suspicious').length,
    ok: businesses.filter((b) => b.arnonaStatus === 'ok').length,
    unknown: businesses.filter((b) => b.arnonaStatus === 'unknown').length,
  }

  function clearAll() {
    if (confirm('למחוק את כל הנתונים?')) {
      localStorage.removeItem('businesses')
      setBusinesses([])
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סוכן ארנונה</h1>
          <p className="text-sm text-gray-500">זיהוי עסקים החשודים בתשלום ארנונת מגורים — עיריית ירושלים</p>
        </div>
        <div className="flex gap-2">
          {businesses.length > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              נקה הכל
            </button>
          )}
          <Link
            href="/upload"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + העלה קובץ יומי
          </Link>
        </div>
      </div>

      {businesses.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="סה״כ עסקים" value={stats.total} color="blue" onClick={() => setFilter('all')} active={filter === 'all'} />
          <StatCard label="חשודים" value={stats.suspicious} color="red" onClick={() => setFilter('suspicious')} active={filter === 'suspicious'} />
          <StatCard label="תקינים" value={stats.ok} color="green" onClick={() => setFilter('ok')} active={filter === 'ok'} />
          <StatCard label="לא ידוע" value={stats.unknown} color="gray" onClick={() => setFilter('unknown')} active={filter === 'unknown'} />
        </div>
      )}

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

      {businesses.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📂</p>
          <p className="text-lg font-medium text-gray-600">אין נתונים עדיין</p>
          <p className="text-sm mt-1">העלה קובץ אקסל יומי כדי להתחיל</p>
          <Link href="/upload" className="mt-4 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            העלה עכשיו
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">שם העסק</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">כתובת</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">סוג עסק</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">סטטוס ארנונה</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">תאריך העלאה</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.address}</td>
                  <td className="px-4 py-3 text-gray-600">{b.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[b.arnonaStatus]}`}>
                      {STATUS_LABEL[b.arnonaStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.uploadDate}</td>
                  <td className="px-4 py-3">
                    {b.link && (
                      <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs">
                        מקור
                      </a>
                    )}
                  </td>
                </tr>
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

function StatCard({
  label, value, color, onClick, active,
}: {
  label: string; value: number; color: string; onClick: () => void; active: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
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
