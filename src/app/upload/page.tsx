'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import type { Business } from '@/lib/types'

type Status = 'idle' | 'processing' | 'done' | 'error'

function mapStatus(rating: string): Business['arnonaStatus'] {
  const r = rating.trim()
  if (r === 'גבוה' || r === 'בינוני') return 'suspicious'
  if (r === 'לא חשוד') return 'ok'
  return 'unknown'
}

function parseFile(buffer: ArrayBuffer): Business[] {
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  // Find the real header row — look for "שם העסק"
  const headerIdx = rawRows.findIndex((row) => row.some((cell) => String(cell).trim() === 'שם העסק'))
  if (headerIdx === -1) throw new Error('לא נמצאה עמודת "שם העסק" — ודא שהקובץ במבנה הנכון')

  const headers = rawRows[headerIdx].map((h) => String(h).trim())
  const col = (row: string[], name: string) => {
    const idx = headers.findIndex((h) => h.includes(name))
    return idx >= 0 ? String(row[idx] ?? '').trim() : ''
  }

  const today = new Date().toLocaleDateString('he-IL')

  return rawRows
    .slice(headerIdx + 1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row, i) => {
      const rating = col(row, 'דירוג חשד')
      return {
        id: `${Date.now()}-${i}`,
        name: col(row, 'שם העסק'),
        type: col(row, 'סוג העסק') || col(row, 'סוג עסק'),
        address: col(row, 'כתובת'),
        matchedAddress: col(row, 'כתובת תואמת'),
        propertyOwners: col(row, 'שמות בעלי נכסים'),
        unitCount: col(row, "מס' דירות"),
        suspicionRating: rating,
        suspicionDetail: col(row, 'פירוט החשד'),
        noSuspicionReason: col(row, 'סיבת אי-חשד'),
        link: col(row, 'מקור') || col(row, 'URL'),
        arnonaStatus: mapStatus(rating),
        uploadDate: today,
      }
    })
    .filter((b) => b.name)
}

export default function UploadPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<Business[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    setStatus('processing')
    setMessage('מעבד את הקובץ...')
    try {
      const buffer = await file.arrayBuffer()
      const newBusinesses = parseFile(buffer)

      const stored = localStorage.getItem('businesses')
      const existing: Business[] = stored ? JSON.parse(stored) : []
      const existingKeys = new Set(existing.map((b) => `${b.name}|${b.address}`))
      const toAdd = newBusinesses.filter((b) => !existingKeys.has(`${b.name}|${b.address}`))
      localStorage.setItem('businesses', JSON.stringify([...existing, ...toAdd]))

      setPreview(newBusinesses)
      setStatus('done')
      setMessage(`נוספו ${toAdd.length} עסקים חדשים (${newBusinesses.length - toAdd.length} כפולים דולגו)`)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'שגיאה בעיבוד הקובץ')
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const RATING_CLASS: Record<string, string> = {
    'גבוה': 'bg-red-100 text-red-700',
    'בינוני': 'bg-orange-100 text-orange-700',
    'לא חשוד': 'bg-green-100 text-green-700',
    'דרוש בדיקה': 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => router.push('/')} className="text-sm text-blue-600 hover:underline mb-2 block">
          ← חזרה לדשבורד
        </button>
        <h1 className="text-xl font-bold text-gray-900">העלאת דוח יומי</h1>
        <p className="text-sm text-gray-500 mt-1">
          קובץ בפורמט: <strong>דוח נכסים חשודים</strong> עם עמודות שם העסק, סוג העסק, כתובת, דירוג חשד וכד׳
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
      >
        <p className="text-4xl mb-3">📄</p>
        <p className="font-medium text-gray-700">גרור קובץ אקסל לכאן או לחץ לבחירה</p>
        <p className="text-sm text-gray-400 mt-1">תומך בפורמט .xlsx</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
      </div>

      {status !== 'idle' && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${
          status === 'error' ? 'bg-red-50 text-red-700' :
          status === 'done' ? 'bg-green-50 text-green-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {status === 'processing' && <span className="inline-block animate-spin mr-2">⏳</span>}
          {message}
        </div>
      )}

      {status === 'done' && preview.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">תצוגה מקדימה — {preview.length} עסקים</h2>
            <div className="flex gap-2 text-xs">
              {Object.entries(
                preview.reduce((acc, b) => {
                  acc[b.suspicionRating] = (acc[b.suspicionRating] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([rating, count]) => (
                <span key={rating} className={`px-2 py-1 rounded-full font-medium ${RATING_CLASS[rating] ?? 'bg-gray-100 text-gray-600'}`}>
                  {rating}: {count}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">שם העסק</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">כתובת</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">דירוג חשד</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">פירוט</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{b.name}</td>
                    <td className="px-3 py-2 text-gray-500">{b.address}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RATING_CLASS[b.suspicionRating] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.suspicionRating || 'לא ידוע'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs max-w-xs truncate">{b.suspicionDetail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            עבור לדשבורד
          </button>
        </div>
      )}
    </div>
  )
}
