'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/AppLayout'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business } from '@/lib/types'

const RATING_CLASS: Record<string, string> = {
  'גבוה':        'bg-red-100 text-red-700',
  'בינוני':      'bg-orange-100 text-orange-700',
  'לא חשוד':    'bg-green-100 text-green-700',
  'דרוש בדיקה': 'bg-yellow-100 text-yellow-700',
}

const ALL_RATINGS = ['גבוה', 'בינוני', 'דרוש בדיקה', 'לא חשוד']

export default function BusinessesPage() {
  const ready = useRequireAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('הכל')
  const [typeFilter, setTypeFilter] = useState('הכל')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const b = localStorage.getItem('businesses')
    if (b) setBusinesses(JSON.parse(b))
  }, [])

  const businessTypes = useMemo(() => {
    const types = [...new Set(businesses.map((b) => b.type).filter(Boolean))].sort()
    return types
  }, [businesses])

  const filtered = useMemo(() => {
    return businesses.filter((b) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q) ||
        b.propertyOwners?.toLowerCase().includes(q)
      const matchRating = ratingFilter === 'הכל' || b.suspicionRating === ratingFilter
      const matchType = typeFilter === 'הכל' || b.type === typeFilter
      return matchSearch && matchRating && matchType
    })
  }, [businesses, search, ratingFilter, typeFilter])

  function deleteBusiness(id: string) {
    if (!confirm('למחוק עסק זה?')) return
    const updated = businesses.filter((b) => b.id !== id)
    setBusinesses(updated)
    localStorage.setItem('businesses', JSON.stringify(updated))
    if (expanded === id) setExpanded(null)
  }

  if (!ready) return null

  return (
    <AppLayout>
      <div className="px-6 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">כלל הנתונים</h1>
          <p className="text-sm text-gray-500">{filtered.length} עסקים מתוך {businesses.length}</p>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <input
            type="text"
            placeholder="חיפוש לפי שם, כתובת, סוג עסק, בעלי נכסים..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="הכל">כל הדירוגים</option>
            {ALL_RATINGS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="הכל">כל סוגי העסק</option>
            {businessTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {(search || ratingFilter !== 'הכל' || typeFilter !== 'הכל') && (
            <button
              onClick={() => { setSearch(''); setRatingFilter('הכל'); setTypeFilter('הכל') }}
              className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              נקה סינון
            </button>
          )}
        </div>

        {businesses.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🏢</p>
            <p className="text-lg font-medium text-gray-600">אין עסקים במערכת</p>
            <a href="/upload" className="mt-4 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              העלה דוח ראשון
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  <th className="w-8 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">לא נמצאו תוצאות</td>
                  </tr>
                ) : filtered.map((b) => (
                  <>
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 cursor-pointer group"
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                    >
                      <td className="px-3 py-3 text-gray-400 text-xs select-none">
                        {expanded === b.id ? '▾' : '▸'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-3 text-gray-500">{b.type}</td>
                      <td className="px-4 py-3 text-gray-600">{b.address}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${RATING_CLASS[b.suspicionRating] ?? 'bg-gray-100 text-gray-500'}`}>
                          {b.suspicionRating || 'לא ידוע'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{b.unitCount || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.uploadDate}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteBusiness(b.id) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-lg leading-none"
                          title="מחק עסק"
                        >
                          ×
                        </button>
                      </td>
                    </tr>

                    {expanded === b.id && (
                      <tr key={`${b.id}-exp`} className="bg-blue-50 border-blue-100">
                        <td colSpan={8} className="px-6 py-5">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                            {b.matchedAddress && (
                              <DetailRow label="כתובת תואמת מהעירייה" value={b.matchedAddress} />
                            )}
                            {b.unitCount && (
                              <DetailRow label="מספר יחידות בכתובת" value={b.unitCount} />
                            )}
                            {b.suspicionDetail && (
                              <DetailRow label="פירוט החשד" value={b.suspicionDetail} full />
                            )}
                            {b.noSuspicionReason && (
                              <DetailRow label="סיבת אי-חשד" value={b.noSuspicionReason} full />
                            )}
                            {b.propertyOwners && (
                              <DetailRow label="שמות בעלי נכסים" value={b.propertyOwners} full />
                            )}
                            {b.link && (
                              <div className="col-span-2">
                                <span className="text-gray-500 font-medium">קישור למקור: </span>
                                <a
                                  href={b.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                >
                                  {b.link}
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

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
              מציג {filtered.length} מתוך {businesses.length} עסקים
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function DetailRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <span className="font-medium text-gray-600">{label}: </span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
