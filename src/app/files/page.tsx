'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { useRequireAuth } from '@/lib/useAuth'
import type { Business, UploadSession } from '@/lib/types'

const RATING_CLASS: Record<string, string> = {
  'גבוה':        'bg-red-100 text-red-700',
  'בינוני':      'bg-orange-100 text-orange-700',
  'לא חשוד':    'bg-green-100 text-green-700',
  'דרוש בדיקה': 'bg-yellow-100 text-yellow-700',
}

export default function FilesPage() {
  const ready = useRequireAuth()
  const [sessions, setSessions] = useState<UploadSession[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const s = localStorage.getItem('uploadSessions')
    const b = localStorage.getItem('businesses')
    if (s) setSessions(JSON.parse(s))
    if (b) setBusinesses(JSON.parse(b))
  }, [])

  if (!ready) return null

  const selectedSession = sessions.find((s) => s.id === selectedId)
  const selectedBusinesses = selectedId
    ? businesses.filter((b) => b.uploadSessionId === selectedId)
    : []

  function deleteSession(sessionId: string) {
    if (!confirm('למחוק את הקובץ וכל העסקים שלו?')) return
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    const newSessions = sessions.filter((s) => s.id !== sessionId)
    const newBusinesses = businesses.filter((b) => b.uploadSessionId !== sessionId)
    localStorage.setItem('uploadSessions', JSON.stringify(newSessions))
    localStorage.setItem('businesses', JSON.stringify(newBusinesses))
    setSessions(newSessions)
    setBusinesses(newBusinesses)
    if (selectedId === sessionId) setSelectedId(null)
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">קבצים שהועלו</h1>
          <p className="text-sm text-gray-500">{sessions.length} קבצים — {businesses.length} עסקים סה״כ</p>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">📁</p>
            <p className="text-lg font-medium text-gray-600">לא הועלו קבצים עדיין</p>
            <a href="/upload" className="mt-4 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              העלה קובץ
            </a>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sessions list */}
            <div className="w-80 flex-shrink-0 space-y-2">
              {[...sessions].reverse().map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedId(selectedId === session.id ? null : session.id)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                    selectedId === session.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{session.fileName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{session.uploadDate}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                      className="text-gray-300 hover:text-red-500 text-lg leading-none flex-shrink-0"
                      title="מחק קובץ"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Badge label={`סה״כ: ${session.totalCount}`} color="gray" />
                    {session.suspiciousCount > 0 && <Badge label={`חשוד: ${session.suspiciousCount}`} color="red" />}
                    {session.okCount > 0 && <Badge label={`תקין: ${session.okCount}`} color="green" />}
                    {session.unknownCount > 0 && <Badge label={`בדיקה: ${session.unknownCount}`} color="yellow" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Businesses panel */}
            <div className="flex-1 min-w-0">
              {!selectedId ? (
                <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-48 text-gray-400 text-sm">
                  בחר קובץ כדי לראות את הנכסים שלו
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <p className="font-semibold text-gray-800">{selectedSession?.fileName}</p>
                    <p className="text-xs text-gray-400">{selectedBusinesses.length} עסקים</p>
                  </div>
                  <div className="overflow-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">שם העסק</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">כתובת</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">דירוג</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">פירוט</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedBusinesses.map((b) => (
                          <tr key={b.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{b.name}</td>
                            <td className="px-4 py-2 text-gray-500">{b.address}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RATING_CLASS[b.suspicionRating] ?? 'bg-gray-100 text-gray-500'}`}>
                                {b.suspicionRating || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">
                              {b.suspicionDetail || b.noSuspicionReason || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600',
    red:    'bg-red-100 text-red-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[color]}`}>{label}</span>
}
