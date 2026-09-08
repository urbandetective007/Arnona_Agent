'use client'

import { useEffect, useState } from 'react'
import { FileSpreadsheet, Trash2, Upload as UploadIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business, UploadSession } from '@/lib/types'
import { supabase, dbToBusiness, dbToSession, sessionToDb } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { formatDate } from '@/lib/dateUtils'
import { Card, Badge, Button, Spinner, EmptyState } from '@/components/ui'
import type { BadgeTone } from '@/components/ui'

const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid', 'לא חשוד': 'clear' }

export default function FilesPage() {
  const ready = useRequireRole(['employee'])
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [sessions, setSessions] = useState<UploadSession[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cachedS = getCache<UploadSession[]>('sessions')
    const cachedB = getCache<Business[]>('businesses')
    if (cachedS && cachedB) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setSessions(cachedS)
      setBusinesses(cachedB)
      setLoading(false)
    }
    Promise.all([
      supabase.from('upload_sessions').select('*'),
      supabase.from('businesses').select('*'),
    ]).then(([{ data: sData }, { data: bData }]) => {
      if (sData) { const s = sData.map(dbToSession); setSessions(s); setCache('sessions', s) }
      if (bData) { const b = bData.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  async function deleteSession(id: string) {
    if (!confirm('למחוק את הקובץ וכל העסקים שלו?')) return
    await supabase.from('businesses').delete().eq('upload_session_id', id)
    await supabase.from('upload_sessions').delete().eq('id', id)
    const nextS = sessions.filter(s => s.id !== id)
    const nextB = businesses.filter(b => b.uploadSessionId !== id)
    setSessions(nextS); setBusinesses(nextB)
    setCache('sessions', nextS); setCache('businesses', nextB)
    if (selectedId === id) setSelectedId(null)
  }

  async function deleteBusiness(id: string) {
    const next = businesses.filter(b => b.id !== id)
    setBusinesses(next); setCache('businesses', next)
    await supabase.from('businesses').delete().eq('id', id)

    const nextSessions = await Promise.all(sessions.map(async s => {
      if (!s.businessIds.includes(id)) return s
      const upd = next.filter(b => s.businessIds.includes(b.id))
      const updated: UploadSession = {
        ...s,
        totalCount: upd.length,
        suspiciousCount: upd.filter(b => b.arnonaStatus === 'suspicious').length,
        okCount: upd.filter(b => b.arnonaStatus === 'ok').length,
        unknownCount: upd.filter(b => b.arnonaStatus === 'unknown').length,
        businessIds: upd.map(b => b.id),
      }
      await supabase.from('upload_sessions').update(sessionToDb(updated)).eq('id', s.id)
      return updated
    }))
    setSessions(nextSessions); setCache('sessions', nextSessions)
  }

  async function clearAll() {
    if (!confirm('למחוק את כל הנתונים? פעולה זו בלתי הפיכה.')) return
    await supabase.from('businesses').delete().neq('id', '')
    await supabase.from('upload_sessions').delete().neq('id', '')
    setSessions([]); setBusinesses([]); setSelectedId(null)
    setCache('businesses', []); setCache('sessions', [])
  }

  if (!ready) return null

  if (loading) {
    return (
      <AppShell title="קבצים שהועלו">
        <Spinner fullHeight />
      </AppShell>
    )
  }

  const selected = sessions.find(s => s.id === selectedId)
  const selectedBusinesses = selectedId ? businesses.filter(b => b.uploadSessionId === selectedId) : []

  return (
    <AppShell
      title="קבצים שהועלו"
      subtitle={`${sessions.length.toLocaleString('he')} קבצים · ${businesses.length.toLocaleString('he')} עסקים סה״כ`}
      actions={
        (sessions.length > 0 || businesses.length > 0) && (
          <Button variant="secondary" icon={<Trash2 size={15} strokeWidth={1.9} />} onClick={clearAll} className="!text-high !border-high/30 hover:!bg-high/5">
            נקה את כל הנתונים
          </Button>
        )
      }
    >
      {sessions.length === 0 && businesses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet size={40} strokeWidth={1.5} />}
            title="לא הועלו קבצים עדיין"
            action={<Button href="/upload">העלאת קובץ ראשון</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
          <div className="flex flex-col gap-2.5">
            {[...sessions].reverse().map(session => {
              const active = selectedId === session.id
              return (
                <button
                  key={session.id}
                  onClick={() => setSelectedId(active ? null : session.id)}
                  className={`text-start rounded-xl p-4 transition-colors border-2 ${active ? 'border-brand bg-brand/[0.04]' : 'border-transparent bg-surface hover:bg-canvas'} shadow-[0_1px_2px_rgba(15,26,40,0.03)]`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[13.5px] text-ink truncate">{session.fileName}</p>
                      <p className="text-[12px] text-subtle mt-0.5">{formatDate(session.uploadDate)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                      className="text-subtle hover:text-high shrink-0"
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    <Badge tone="brand">חדש: {session.totalCount}</Badge>
                    {session.skippedCount > 0 && <Badge tone="mid">כפול: {session.skippedCount}</Badge>}
                    {session.suspiciousCount > 0 && <Badge tone="high">אינדיקציה: {session.suspiciousCount}</Badge>}
                    {session.okCount > 0 && <Badge tone="clear">תקין: {session.okCount}</Badge>}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="min-w-0">
            {!selectedId ? (
              <Card>
                <EmptyState title="בחר קובץ מהרשימה כדי לראות את הנכסים שלו" />
              </Card>
            ) : (
              <Card padded={false}>
                <div className="flex items-center justify-between px-5 py-4 bg-canvas border-b border-hairline">
                  <div>
                    <p className="font-semibold text-ink">{selected?.fileName}</p>
                    <p className="text-[12px] text-subtle mt-0.5">{selectedBusinesses.length.toLocaleString('he')} עסקים</p>
                  </div>
                  <Button variant="secondary" icon={<Trash2 size={14} strokeWidth={1.9} />} onClick={() => deleteSession(selectedId)} className="!text-high !border-high/30 h-9">
                    מחק קובץ
                  </Button>
                </div>
                {selected && selected.totalCount > 0 && (
                  <div className="flex gap-6 px-5 py-2.5 bg-brand/[0.04] border-b border-hairline text-[13px]">
                    <span className="text-brand font-semibold">✓ {selected.totalCount} עסקים חדשים נוספו</span>
                    {selected.skippedCount > 0 && <span className="text-mid font-semibold">⊘ {selected.skippedCount} כפולים דולגו</span>}
                  </div>
                )}
                <div className="overflow-auto max-h-[560px]">
                  <table className="w-full border-collapse text-[13px]">
                    <thead className="sticky top-0 bg-canvas z-10">
                      <tr className="border-b border-hairline">
                        {['שם העסק', 'כתובת', 'דירוג', 'פירוט', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-start text-[12px] font-semibold text-graphite whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {selectedBusinesses.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-8 text-graphite">אין עסקים בקובץ זה</td></tr>
                      ) : selectedBusinesses.map(b => (
                        <tr key={b.id}>
                          <td className="px-4 py-3 font-semibold text-ink">{b.name}</td>
                          <td className="px-4 py-3 text-charcoal">{b.address}</td>
                          <td className="px-4 py-3">
                            {b.suspicionRating ? <Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'}>{b.suspicionRating}</Badge> : '—'}
                          </td>
                          <td className="px-4 py-3 text-subtle text-[12px] max-w-[220px] truncate" title={b.suspicionDetail || b.noSuspicionReason}>
                            {b.suspicionDetail || b.noSuspicionReason || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { if (confirm(`למחוק "${b.name}"?`)) deleteBusiness(b.id) }} className="text-subtle hover:text-high" title="מחק">
                              <Trash2 size={14} strokeWidth={1.8} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      <div
        className="mt-4 rounded-xl p-5 flex items-center justify-between gap-6 flex-wrap"
        style={{ background: 'linear-gradient(180deg, var(--color-chrome) 0%, var(--color-chrome-deep) 100%)' }}
      >
        <div className="flex items-center gap-1.5 text-chrome-graphite text-sm">
          <UploadIcon size={13} strokeWidth={2} />
          להוספת נתונים חדשים — העלה דוח יומי
        </div>
        <Button href="/upload" variant="onDark" className="shrink-0">העלאת דוח חדש</Button>
      </div>
    </AppShell>
  )
}
