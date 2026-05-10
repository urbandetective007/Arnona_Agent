'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { lookupAddress } from '@/lib/addressUtils'
import type { Business } from '@/lib/types'

type Status = 'idle' | 'loading-lookup' | 'processing' | 'done' | 'error'

export default function UploadPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<Business[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    setStatus('loading-lookup')
    setMessage('טוען נתוני ארנונה...')

    let lookup: Record<string, boolean>
    try {
      const res = await fetch('/arnona_lookup.json')
      lookup = await res.json()
    } catch {
      setStatus('error')
      setMessage('שגיאה בטעינת נתוני הארנונה')
      return
    }

    setStatus('processing')
    setMessage('מעבד את הקובץ...')

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

      const today = new Date().toLocaleDateString('he-IL')
      const newBusinesses: Business[] = rows.map((row, i) => {
        const address = String(row['כתובת'] || '').trim()
        return {
          id: `${Date.now()}-${i}`,
          name: String(row['שם העסק'] || '').trim(),
          address,
          type: String(row['סוג עסק'] || '').trim(),
          link: String(row['קישור למקור'] || '').trim(),
          arnonaStatus: lookupAddress(address, lookup),
          uploadDate: today,
        }
      }).filter((b) => b.name)

      // Merge with existing data (avoid duplicates by name+address)
      const stored = localStorage.getItem('businesses')
      const existing: Business[] = stored ? JSON.parse(stored) : []
      const existingKeys = new Set(existing.map((b) => `${b.name}|${b.address}`))
      const toAdd = newBusinesses.filter((b) => !existingKeys.has(`${b.name}|${b.address}`))
      const merged = [...existing, ...toAdd]
      localStorage.setItem('businesses', JSON.stringify(merged))

      setPreview(newBusinesses)
      setStatus('done')
      setMessage(`נוספו ${toAdd.length} עסקים חדשים (${newBusinesses.length - toAdd.length} כפולים דולגו)`)
    } catch {
      setStatus('error')
      setMessage('שגיאה בעיבוד הקובץ — ודא שהעמודות: שם העסק, כתובת, סוג עסק, קישור למקור')
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

  const suspicious = preview.filter((b) => b.arnonaStatus === 'suspicious').length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => router.push('/')} className="text-sm text-blue-600 hover:underline mb-2 block">
          ← חזרה לדשבורד
        </button>
        <h1 className="text-xl font-bold text-gray-900">העלאת קובץ יומי</h1>
        <p className="text-sm text-gray-500 mt-1">
          קובץ האקסל חייב לכלול עמודות: <strong>שם העסק, כתובת, סוג עסק, קישור למקור</strong>
        </p>
      </div>

      {/* Drop zone */}
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

      {/* Status */}
      {status !== 'idle' && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${
          status === 'error' ? 'bg-red-50 text-red-700' :
          status === 'done' ? 'bg-green-50 text-green-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {(status === 'loading-lookup' || status === 'processing') && (
            <span className="inline-block animate-spin mr-2">⏳</span>
          )}
          {message}
        </div>
      )}

      {/* Preview */}
      {status === 'done' && preview.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">תצוגה מקדימה — {preview.length} עסקים</h2>
            {suspicious > 0 && (
              <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-medium">
                {suspicious} חשודים
              </span>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">שם</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">כתובת</th>
                  <th className="text-right px-3 py-2 text-gray-600 font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{b.name}</td>
                    <td className="px-3 py-2 text-gray-500">{b.address}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.arnonaStatus === 'suspicious' ? 'bg-red-100 text-red-700' :
                        b.arnonaStatus === 'ok' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {b.arnonaStatus === 'suspicious' ? 'חשוד' : b.arnonaStatus === 'ok' ? 'תקין' : 'לא ידוע'}
                      </span>
                    </td>
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
