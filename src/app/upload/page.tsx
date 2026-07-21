'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clearCache } from '@/lib/cache'
import * as XLSX from 'xlsx'
import { useRequireAuth } from '@/lib/useAuth'
import AppLayout from '@/components/AppLayout'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, businessToDb, sessionToDb } from '@/lib/supabase'

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
      const rating = col(row, 'דירוג אינדיקציה')
      return {
        id: `${sessionId}-${i}`,
        name: col(row, 'שם העסק'),
        type: col(row, 'סוג עסק'),
        address: col(row, 'כתובת'),
        matchedAddress: col(row, 'כתובת תואמת'),
        propertyOwners: col(row, 'שמות בעלי נכסים'),
        unitCount: col(row, "מס' דירות"),
        suspicionRating: rating,
        suspicionDetail: col(row, 'פירוט האינדיקציה'),
        noSuspicionReason: col(row, 'סיבת אי-אינדיקציה'),
        link1: col(row, 'קישור 1'),
        link2: col(row, 'קישור 2'),
        link3: col(row, 'קישור 3'),
        arnonaStatus: mapStatus(rating),
        uploadDate: today,
        uploadSessionId: sessionId,
        sentToInspector: null,
      }
    })
    .filter(b => b.name)
}

const RATING_STYLE: Record<string, React.CSSProperties> = {
  'גבוה':        { background: '#fef2f2', color: '#b91c1c' },
  'בינוני':      { background: '#fff7ed', color: '#c2410c' },
  'לא חשוד':    { background: '#f0fdf4', color: '#15803d' },
  'דרוש בדיקה': { background: 'var(--cloud)', color: 'var(--charcoal)' },
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

      // fetch existing name|address pairs to deduplicate
      const { data: existing } = await supabase
        .from('businesses')
        .select('name, address')

      const keys = new Set((existing ?? []).map((b: {name: string, address: string}) => `${b.name}|${b.address}`))
      const toAdd = newBiz.filter(b => !keys.has(`${b.name}|${b.address}`))

      const session: UploadSession = {
        id: sessionId,
        fileName: file.name,
        uploadDate: today,
        totalCount: toAdd.length,
        suspiciousCount: toAdd.filter(b => b.arnonaStatus === 'suspicious').length,
        okCount:         toAdd.filter(b => b.arnonaStatus === 'ok').length,
        unknownCount:    toAdd.filter(b => b.arnonaStatus === 'unknown').length,
        skippedCount:    newBiz.length - toAdd.length,
        businessIds:     toAdd.map(b => b.id),
      }

      // Insert session FIRST (businesses reference it via FK)
      const { error: sessionErr } = await supabase.from('upload_sessions').insert(sessionToDb(session))
      if (sessionErr) throw new Error(`שגיאה בשמירת הסשן: ${sessionErr.message}`)

      if (toAdd.length > 0) {
        const { error: bizErr } = await supabase.from('businesses').insert(toAdd.map(businessToDb))
        if (bizErr) throw new Error(`שגיאה בשמירת העסקים: ${bizErr.message}`)
      }

      clearCache('businesses', 'sessions')
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
      {/* ── White header ── */}
      <section style={{ background: 'var(--canvas)', padding: '48px 48px 32px' }}>
        <p style={eyebrow}>ניתוח ארנונה · עיריית ירושלים</p>
        <h1 style={{ fontSize: 44, fontWeight: 500 }}>העלאת דוח חדש</h1>
        <p style={{ color: 'var(--charcoal)', marginTop: 6 }}>
          קובץ בפורמט דוח נכסים לבדיקה — עמודות: שם העסק, כתובת, סוג עסק, דירוג אינדיקציה, קישורים
        </p>
      </section>

      {/* ── Cloud: drop zone ── */}
      <section style={{ background: 'var(--cloud)', padding: '40px 48px 48px' }}>
        <div
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed var(--steel)',
            borderRadius: 16, padding: '64px 48px',
            textAlign: 'center', cursor: 'pointer',
            background: 'var(--canvas)',
            maxWidth: 640,
          }}
        >
          <p style={{ fontSize: 40, marginBottom: 16, color: 'var(--steel)' }}>↑</p>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            גרור קובץ אקסל לכאן
          </p>
          <p style={{ color: 'var(--graphite)', fontSize: 14 }}>או לחץ לבחירת קובץ · פורמט .xlsx</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            style={{ display: 'none' }}
          />
        </div>

        {status !== 'idle' && (
          <div style={{
            marginTop: 16, padding: '14px 20px', borderRadius: 4, fontSize: 14, maxWidth: 640,
            background: status === 'error' ? '#fef2f2' : status === 'done' ? '#f0fdf4' : 'var(--fog)',
            color: status === 'error' ? '#b91c1c' : status === 'done' ? '#15803d' : 'var(--charcoal)',
            border: `1px solid ${status === 'error' ? '#fecaca' : status === 'done' ? '#bbf7d0' : 'var(--hairline)'}`,
            fontWeight: 500,
          }}>
            {message}
          </div>
        )}
      </section>

      {/* ── White: preview table ── */}
      {status === 'done' && preview.length > 0 && (
        <section style={{ background: 'var(--canvas)', padding: '40px 48px' }}>
          <h2 style={{ fontSize: 24, fontWeight: 500, marginBottom: 24 }}>
            תצוגה מקדימה — {preview.length} עסקים
          </h2>
          <div style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(26,26,26,0.08)', maxWidth: 800 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--cloud)', borderBottom: '1px solid var(--hairline)' }}>
                  {['שם העסק', 'כתובת', 'דירוג אינדיקציה'].map(h => (
                    <th key={h} style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink)' }}>{b.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--charcoal)' }}>{b.address}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...(RATING_STYLE[b.suspicionRating] ?? { background: 'var(--cloud)', color: 'var(--charcoal)' }), borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                        {b.suspicionRating || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => router.push('/')} style={btnPrimary}>עבור לדשבורד</button>
            <button onClick={() => router.push('/files')} style={btnOutline}>צפה בקבצים</button>
          </div>
        </section>
      )}

      {/* ── Ink footer slab ── */}
      <section style={{ background: 'var(--ink)', padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ color: 'var(--steel)', fontSize: 16 }}>צפה בנתונים שהועלו עד כה</p>
        <Link href="/files" style={btnWhite}>קבצים שהועלו</Link>
      </section>
    </AppLayout>
  )
}

const eyebrow: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--graphite)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }
const btnPrimary: React.CSSProperties = { height: 44, padding: '0 24px', background: 'var(--hp-blue)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnOutline: React.CSSProperties = { height: 44, padding: '0 24px', background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }
const btnWhite: React.CSSProperties = { display: 'inline-block', height: 44, padding: '0 24px', lineHeight: '44px', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 4, fontSize: 14, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', textDecoration: 'none', flexShrink: 0 }
