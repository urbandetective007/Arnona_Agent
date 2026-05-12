'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useRequireAuth } from '@/lib/useAuth'
import AppLayout from '@/components/AppLayout'
import type { Business, UploadSession } from '@/lib/types'

type Status = 'idle' | 'processing' | 'done' | 'error'

function mapStatus(rating: string): Business['arnonaStatus'] {
  const r = rating.trim()
  if (r === 'גבוה' || r === 'בינוני') return 'suspicious'
  if (r === 'לא חשוד') return 'ok'
  return 'unknown'
}

function parseFile(buffer: ArrayBuffer, sessionId: string, today: string): Business[] {
  const wb  = XLSX.read(buffer)
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  const hIdx = raw.findIndex(row => row.some(c => String(c).trim() === 'שם העסק'))
  if (hIdx === -1) throw new Error('לא נמצאה עמודת "שם העסק" — ודא שהקובץ במבנה הנכון')

  const headers = raw[hIdx].map(h => String(h).trim())
  const col = (row: string[], name: string) => {
    const idx = headers.findIndex(h => h.includes(name))
    return idx >= 0 ? String(row[idx] ?? '').trim() : ''
  }

  return raw.slice(hIdx + 1)
    .filter(row => row.some(c => String(c).trim()))
    .map((row, i) => {
      const rating = col(row, 'דירוג חשד')
      return {
        id: `${sessionId}-${i}`,
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
        uploadSessionId: sessionId,
      }
    })
    .filter(b => b.name)
}

const RATING_STYLE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#991b1b' },
  'בינוני':      { background: '#fff7ed', color: '#9a3412' },
  'לא חשוד':    { background: '#f0fdf4', color: '#166534' },
  'דרוש בדיקה': { background: '#fefce8', color: '#854d0e' },
}

export default function UploadPage() {
  const ready   = useRequireAuth()
  const [status,  setStatus]  = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<Business[]>([])
  const fileRef  = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  async function handleFile(file: File) {
    setStatus('processing')
    setMessage('מעבד את הקובץ...')
    try {
      const buffer    = await file.arrayBuffer()
      const sessionId = `session-${Date.now()}`
      const today     = new Date().toLocaleDateString('he-IL')
      const newBiz    = parseFile(buffer, sessionId, today)

      const stored   = localStorage.getItem('businesses')
      const existing: Business[] = stored ? JSON.parse(stored) : []
      const keys     = new Set(existing.map(b => `${b.name}|${b.address}`))
      const toAdd    = newBiz.filter(b => !keys.has(`${b.name}|${b.address}`))
      localStorage.setItem('businesses', JSON.stringify([...existing, ...toAdd]))

      const session: UploadSession = {
        id: sessionId, fileName: file.name, uploadDate: today,
        totalCount: toAdd.length,
        suspiciousCount: toAdd.filter(b => b.arnonaStatus === 'suspicious').length,
        okCount:         toAdd.filter(b => b.arnonaStatus === 'ok').length,
        unknownCount:    toAdd.filter(b => b.arnonaStatus === 'unknown').length,
        businessIds:     toAdd.map(b => b.id),
      }
      const storedS  = localStorage.getItem('uploadSessions')
      const sessions: UploadSession[] = storedS ? JSON.parse(storedS) : []
      localStorage.setItem('uploadSessions', JSON.stringify([...sessions, session]))

      setPreview(newBiz)
      setStatus('done')
      setMessage(`נוספו ${toAdd.length} עסקים חדשים${newBiz.length - toAdd.length > 0 ? ` (${newBiz.length - toAdd.length} כפולים דולגו)` : ''}`)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : 'שגיאה בעיבוד הקובץ')
    }
  }

  if (!ready) return null

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ padding: '48px 48px 32px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 8 }}>העלאת דוח חדש</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>
          קובץ בפורמט דוח נכסים חשודים — עמודות: שם העסק, סוג העסק, כתובת, דירוג חשד
        </p>
      </div>

      {/* Drop zone */}
      <div style={{ padding: '0 48px 48px', maxWidth: 680 }}>
        <div
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            border: '1px dashed var(--color-hairline)',
            borderRadius: 12, padding: '64px 48px',
            textAlign: 'center', cursor: 'pointer',
            background: 'var(--color-surface-soft)',
          }}
        >
          <p style={{ fontSize: 32, marginBottom: 12 }}>↑</p>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4 }}>
            גרור קובץ אקסל לכאן
          </p>
          <p style={{ color: 'var(--color-muted)', fontSize: 14 }}>או לחץ לבחירת קובץ · פורמט .xlsx</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            style={{ display: 'none' }}
          />
        </div>

        {/* Status */}
        {status !== 'idle' && (
          <div style={{
            marginTop: 16, padding: '14px 18px', borderRadius: 10, fontSize: 14,
            background: status === 'error' ? '#fef2f2' : status === 'done' ? '#f0fdf4' : 'var(--color-surface-soft)',
            color: status === 'error' ? '#991b1b' : status === 'done' ? '#166534' : 'var(--color-body)',
            border: `1px solid ${status === 'error' ? '#fecaca' : status === 'done' ? '#bbf7d0' : 'var(--color-hairline)'}`,
          }}>
            {message}
          </div>
        )}

        {/* Preview */}
        {status === 'done' && preview.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <p style={{ fontSize: 18, fontWeight: 400, color: 'var(--color-ink)', marginBottom: 16 }}>
              תצוגה מקדימה — {preview.length} עסקים
            </p>
            <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-hairline)' }}>
                    {['שם העסק', 'כתובת', 'דירוג חשד'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--color-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-ink)' }}>{b.name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--color-muted)' }}>{b.address}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...(RATING_STYLE[b.suspicionRating] ?? { background: 'var(--color-surface-soft)', color: 'var(--color-muted)' }), borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
                          {b.suspicionRating || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => router.push('/')} style={btnPrimary}>
                עבור לדשבורד
              </button>
              <button onClick={() => router.push('/files')} style={btnSecondary}>
                צפה בקבצים
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 24px', background: 'var(--color-ink)', color: '#fff',
  borderRadius: 12, fontSize: 16, fontWeight: 500, border: 'none', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '12px 24px', background: 'var(--color-canvas)', color: 'var(--color-ink)',
  borderRadius: 12, fontSize: 16, fontWeight: 500,
  border: '1px solid var(--color-hairline)', cursor: 'pointer',
}
