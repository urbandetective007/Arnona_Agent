'use client'

import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertCircle, AlertTriangle, ArrowLeft, Check, Copy, FileSpreadsheet, Info, Pencil, Plus, Upload } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useRequireRole } from '@/lib/useRequireRole'
import type { Business, UploadSession } from '@/lib/types'
import { mapSuspicionRatingToStatus } from '@/lib/types'
import { supabase, businessToDb, sessionToDb } from '@/lib/supabase'
import { normalizeNeighborhood, JERUSALEM_NEIGHBORHOODS } from '@/lib/neighborhoods'
import { clearCache } from '@/lib/cache'
import { Card, Badge, Button, Input, Select, Toggle } from '@/components/ui'
import type { BadgeTone } from '@/components/ui'

// Alphabetical for the manual-entry picker — the registry itself is ordered
// geographically (by city area), which is not useful for typing/searching.
const SORTED_NEIGHBORHOODS = [...JERUSALEM_NEIGHBORHOODS].sort((a, b) => a.localeCompare(b, 'he'))

type Step = 'upload' | 'mapping' | 'validate' | 'done'
type Mode = 'file' | 'manual'

type TargetField =
  | 'name' | 'address' | 'neighborhood' | 'type' | 'suspicionRating' | 'suspicionDetail'
  | 'noSuspicionReason' | 'propertyOwners' | 'matchedAddress' | 'unitCount' | 'link1' | 'link2' | 'link3'

const FIELD_DEFS: { key: TargetField; label: string; required: boolean; hint: string }[] = [
  { key: 'name', label: 'שם העסק', required: true, hint: 'שם העסק' },
  { key: 'address', label: 'כתובת', required: true, hint: 'כתובת' },
  { key: 'neighborhood', label: 'שכונה', required: false, hint: 'שכונה' },
  { key: 'type', label: 'סוג עסק', required: false, hint: 'סוג עסק' },
  { key: 'suspicionRating', label: 'דירוג אינדיקציה', required: false, hint: 'דירוג אינדיקציה' },
  { key: 'suspicionDetail', label: 'פירוט האינדיקציה', required: false, hint: 'פירוט האינדיקציה' },
  { key: 'noSuspicionReason', label: 'סיבת אי-אינדיקציה', required: false, hint: 'סיבת אי-אינדיקציה' },
  { key: 'propertyOwners', label: 'שמות בעלי נכסים', required: false, hint: 'שמות בעלי נכסים' },
  { key: 'matchedAddress', label: 'כתובת תואמת במערכת הגבייה', required: false, hint: 'כתובת תואמת במערכת הגבייה' },
  { key: 'unitCount', label: "מס' דירות", required: false, hint: "מס' דירות" },
  { key: 'link1', label: 'קישור 1', required: false, hint: 'קישור 1' },
  { key: 'link2', label: 'קישור 2', required: false, hint: 'קישור 2' },
  { key: 'link3', label: 'קישור 3', required: false, hint: 'קישור 3' },
]

// Fields shown in the manual-entry form — same set as FIELD_DEFS minus
// propertyOwners and noSuspicionReason, which the manual flow doesn't collect.
const MANUAL_FIELD_DEFS = FIELD_DEFS.filter(fd => fd.key !== 'propertyOwners' && fd.key !== 'noSuspicionReason')

const EMPTY_MAPPING: Record<TargetField, string> = {
  name: '', address: '', neighborhood: '', type: '', suspicionRating: '', suspicionDetail: '',
  noSuspicionReason: '', propertyOwners: '', matchedAddress: '', unitCount: '', link1: '', link2: '', link3: '',
}

// Manual entries default to the highest rating rather than the file flow's
// "needs review" fallback — an employee filling this in has already looked.
const EMPTY_MANUAL: Record<TargetField, string> = { ...EMPTY_MAPPING, suspicionRating: 'גבוה' }

const RATING_OPTIONS = ['גבוה', 'בינוני', 'לא חשוד', 'דרוש בדיקה']
const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid', 'לא חשוד': 'clear' }

interface RowIssue { row: number; kind: 'error' | 'warning'; title: string; detail: string }
interface PendingSession { sessionId: string; today: string; allParsed: Business[] }
interface ValidationResult { toAdd: Business[]; duplicates: number; issues: RowIssue[] }
interface DoneSummary { added: number; skipped: number; assigned: number; fileName: string }

function parseSheet(buffer: ArrayBuffer): { headers: string[]; hIdx: number; raw: string[][] } {
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  const hIdx = raw.findIndex(row => row.some(c => String(c).trim() === 'שם העסק'))
  if (hIdx === -1) throw new Error('לא נמצאה עמודת "שם העסק" — ודא שהקובץ במבנה הנכון')

  const headers = raw[hIdx].map(h => String(h).trim())
  return { headers, hIdx, raw }
}

function autoMatch(headers: string[], hint: string): string {
  const exact = headers.find(h => h === hint)
  if (exact) return exact
  return headers.find(h => h.includes(hint)) ?? ''
}

function getCol(row: string[], headers: string[], header: string): string {
  if (!header) return ''
  const idx = headers.indexOf(header)
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}

function buildBusinesses(
  raw: string[][], hIdx: number, headers: string[], mapping: Record<TargetField, string>,
  sessionId: string, today: string,
): { businesses: Business[]; issues: RowIssue[] } {
  const businesses: Business[] = []
  const issues: RowIssue[] = []
  let seq = 0

  raw.slice(hIdx + 1).forEach((row, i) => {
    if (!row.some(c => String(c).trim())) return
    const excelRow = hIdx + i + 2

    const name = getCol(row, headers, mapping.name)
    const address = getCol(row, headers, mapping.address)
    if (!name || !address) {
      issues.push({
        row: excelRow,
        kind: 'error',
        title: !name ? 'שם עסק חסר' : 'כתובת חסרה',
        detail: !name ? `שורה ${excelRow} — ללא שם עסק, לא ניתן לייבא` : `"${name}" — ללא כתובת, לא ניתן לייבא`,
      })
      return
    }

    const rawNeighborhood = getCol(row, headers, mapping.neighborhood)
    const neighborhood = normalizeNeighborhood(rawNeighborhood) ?? ''
    if (rawNeighborhood && !neighborhood) {
      issues.push({ row: excelRow, kind: 'warning', title: 'שכונה לא מזוהה', detail: `"${name}" — "${rawNeighborhood}" לא זוהתה, הנכס יישמר ללא שכונה` })
    }

    const rawRating = getCol(row, headers, mapping.suspicionRating)
    const rating = rawRating || 'דרוש בדיקה'
    if (!rawRating) {
      issues.push({ row: excelRow, kind: 'warning', title: 'דירוג אינדיקציה חסר', detail: `"${name}" — יוגדר כ"דרוש בדיקה"` })
    }

    businesses.push({
      id: `${sessionId}-${seq++}`,
      name,
      type: getCol(row, headers, mapping.type),
      address,
      neighborhood,
      matchedAddress: getCol(row, headers, mapping.matchedAddress),
      propertyOwners: getCol(row, headers, mapping.propertyOwners),
      unitCount: getCol(row, headers, mapping.unitCount),
      suspicionRating: rating,
      suspicionDetail: getCol(row, headers, mapping.suspicionDetail),
      noSuspicionReason: getCol(row, headers, mapping.noSuspicionReason),
      link1: getCol(row, headers, mapping.link1),
      link2: getCol(row, headers, mapping.link2),
      link3: getCol(row, headers, mapping.link3),
      arnonaStatus: mapSuspicionRatingToStatus(rating),
      uploadDate: today,
      uploadSessionId: sessionId,
      sentToInspector: null,
      surveyResultDetail: null,
      source: 'excel',
    })
  })

  return { businesses, issues }
}

const FILE_STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'העלאת קובץ' },
  { key: 'mapping', label: 'מיפוי עמודות' },
  { key: 'validate', label: 'אימות ואישור' },
]

const MANUAL_STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'פרטי העסק' },
  { key: 'validate', label: 'אישור והוספה' },
]

function WizardStepper({ step, steps }: { step: Step; steps: { key: Step; label: string }[] }) {
  const idx = step === 'done' ? steps.length : steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center max-w-2xl">
      {steps.map((s, i) => (
        <div key={s.key} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
              i < idx ? 'bg-clear text-white' : i === idx ? 'bg-brand text-white' : 'border-[1.5px] border-hairline text-subtle'
            }`}>
              {i < idx ? <Check size={14} strokeWidth={3.2} /> : <span className="num">{i + 1}</span>}
            </span>
            <span className={`text-[13.5px] whitespace-nowrap ${i === idx ? 'font-bold text-ink' : i < idx ? 'font-semibold text-clear' : 'text-subtle'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-3.5 ${i < idx ? 'bg-clear' : 'bg-hairline'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function UploadPage() {
  const ready = useRequireRole(['employee'])
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('file')
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [raw, setRaw] = useState<string[][]>([])
  const [hIdx, setHIdx] = useState(0)
  const [mapping, setMapping] = useState<Record<TargetField, string>>(EMPTY_MAPPING)
  const [manual, setManual] = useState<Record<TargetField, string>>(EMPTY_MANUAL)
  const [checking, setChecking] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [pendingSession, setPendingSession] = useState<PendingSession | null>(null)
  const [autoAssign, setAutoAssign] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [doneSummary, setDoneSummary] = useState<DoneSummary | null>(null)

  const previewRows = useMemo(() => {
    return raw.slice(hIdx + 1)
      .filter(row => row.some(c => String(c).trim()))
      .slice(0, 6)
      .map(row => ({
        name: getCol(row, headers, mapping.name),
        address: getCol(row, headers, mapping.address),
        rating: getCol(row, headers, mapping.suspicionRating),
      }))
  }, [raw, hIdx, headers, mapping])

  const mappedCount = FIELD_DEFS.filter(fd => mapping[fd.key]).length
  const errorCount = validation ? validation.issues.filter(i => i.kind === 'error').length : 0
  const highCount = validation ? validation.toAdd.filter(b => b.suspicionRating === 'גבוה').length : 0

  async function handleFile(f: File) {
    setParseError('')
    try {
      const buffer = await f.arrayBuffer()
      const parsed = parseSheet(buffer)
      const initial = { ...EMPTY_MAPPING }
      FIELD_DEFS.forEach(fd => { initial[fd.key] = autoMatch(parsed.headers, fd.hint) })
      setFile(f)
      setHeaders(parsed.headers)
      setRaw(parsed.raw)
      setHIdx(parsed.hIdx)
      setMapping(initial)
      setStep('mapping')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'שגיאה בקריאת הקובץ')
    }
  }

  async function checkAndValidate(businesses: Business[], issues: RowIssue[], sessionId: string, today: string) {
    const { data: existing, error } = await supabase.from('businesses').select('name, address')
    if (error) throw new Error(`שגיאה בבדיקת כפילויות: ${error.message}`)

    const keys = new Set((existing ?? []).map((b: { name: string; address: string }) => `${b.name}|${b.address}`))
    const toAdd = businesses.filter(b => !keys.has(`${b.name}|${b.address}`))

    setPendingSession({ sessionId, today, allParsed: businesses })
    setValidation({ toAdd, duplicates: businesses.length - toAdd.length, issues })
    setStep('validate')
  }

  async function proceedToValidate() {
    setChecking(true)
    setSubmitError('')
    try {
      const sessionId = `session-${Date.now()}`
      const today = new Date().toISOString()
      const { businesses, issues } = buildBusinesses(raw, hIdx, headers, mapping, sessionId, today)
      await checkAndValidate(businesses, issues, sessionId, today)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'שגיאה באימות הקובץ')
    } finally {
      setChecking(false)
    }
  }

  async function proceedManualToValidate() {
    setChecking(true)
    setSubmitError('')
    try {
      const sessionId = `session-manual-${Date.now()}`
      const today = new Date().toISOString()
      const rating = manual.suspicionRating || 'גבוה'
      const business: Business = {
        id: `${sessionId}-0`,
        name: manual.name.trim(),
        type: manual.type.trim(),
        address: manual.address.trim(),
        neighborhood: normalizeNeighborhood(manual.neighborhood) ?? '',
        matchedAddress: manual.matchedAddress.trim(),
        propertyOwners: '',
        unitCount: manual.unitCount.trim(),
        suspicionRating: rating,
        suspicionDetail: manual.suspicionDetail.trim(),
        noSuspicionReason: manual.noSuspicionReason.trim(),
        link1: manual.link1.trim(),
        link2: manual.link2.trim(),
        link3: manual.link3.trim(),
        arnonaStatus: mapSuspicionRatingToStatus(rating),
        uploadDate: today,
        uploadSessionId: sessionId,
        sentToInspector: null,
        surveyResultDetail: null,
        source: 'manual',
      }
      await checkAndValidate([business], [], sessionId, today)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'שגיאה באימות הנתונים')
    } finally {
      setChecking(false)
    }
  }

  async function confirmUpload() {
    if (!validation || !pendingSession) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const { toAdd } = validation
      const { sessionId, today, allParsed } = pendingSession
      const fileName = file?.name ?? 'הוספה ידנית'
      const session: UploadSession = {
        id: sessionId,
        fileName,
        uploadDate: today,
        totalCount: toAdd.length,
        suspiciousCount: toAdd.filter(b => b.arnonaStatus === 'suspicious').length,
        okCount: toAdd.filter(b => b.arnonaStatus === 'ok').length,
        unknownCount: toAdd.filter(b => b.arnonaStatus === 'unknown').length,
        skippedCount: allParsed.length - toAdd.length,
        businessIds: toAdd.map(b => b.id),
      }

      const { error: sessionErr } = await supabase.from('upload_sessions').insert(sessionToDb(session))
      if (sessionErr) throw new Error(`שגיאה בשמירת הסשן: ${sessionErr.message}`)

      if (toAdd.length > 0) {
        const { error: bizErr } = await supabase.from('businesses').insert(toAdd.map(businessToDb))
        if (bizErr) throw new Error(`שגיאה בשמירת העסקים: ${bizErr.message}`)
      }

      let assigned = 0
      if (autoAssign) {
        const highIds = toAdd.filter(b => b.suspicionRating === 'גבוה').map(b => b.id)
        if (highIds.length > 0) {
          const { error: assignErr } = await supabase.from('businesses').update({ sent_to_inspector: 'נשלח לסוקר' }).in('id', highIds)
          if (assignErr) throw new Error(`הנכסים נוספו אך ההקצאה לסוקר נכשלה: ${assignErr.message}`)
          assigned = highIds.length
        }
      }

      clearCache('businesses', 'sessions')
      setDoneSummary({ added: toAdd.length, skipped: session.skippedCount, assigned, fileName })
      setStep('done')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'שגיאה בהעלאת הנתונים')
    } finally {
      setSubmitting(false)
    }
  }

  function resetWizard() {
    setStep('upload')
    setFile(null)
    setParseError('')
    setHeaders([])
    setRaw([])
    setHIdx(0)
    setMapping(EMPTY_MAPPING)
    setManual(EMPTY_MANUAL)
    setValidation(null)
    setPendingSession(null)
    setAutoAssign(false)
    setSubmitError('')
    setDoneSummary(null)
  }

  if (!ready) return null

  return (
    <AppShell
      title="העלאת דוח חדש"
      subtitle={file ? (
        <span className="inline-flex items-center gap-1.5">
          <FileSpreadsheet size={13} strokeWidth={2} />
          {file.name} · <span className="num">{(file.size / (1024 * 1024)).toFixed(1)}</span> MB
        </span>
      ) : mode === 'manual'
        ? 'הוספת עסק בודד לבדיקה — ישירות למאגר, בלי קובץ אקסל'
        : 'קובץ בפורמט דוח נכסים לבדיקה — עמודות: שם העסק, כתובת, שכונה, סוג עסק, דירוג אינדיקציה, קישורים'}
      actions={step !== 'upload' && step !== 'done' && (
        <Button variant="ghost" onClick={resetWizard}>ביטול</Button>
      )}
    >
      {step !== 'done' && (
        <div className="mb-6">
          <WizardStepper step={step} steps={mode === 'file' ? FILE_STEPS : MANUAL_STEPS} />
        </div>
      )}

      {step === 'upload' && (
        <>
          <div className="inline-flex bg-surface border border-hairline rounded-xl p-1 mb-5 gap-0.5">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-colors ${
                mode === 'file' ? 'bg-brand text-white shadow-[0_3px_10px_rgba(26,86,219,0.3)]' : 'text-graphite'
              }`}
            >
              <FileSpreadsheet size={15} strokeWidth={2} /> העלאת קובץ אקסל
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-colors ${
                mode === 'manual' ? 'bg-brand text-white shadow-[0_3px_10px_rgba(26,86,219,0.3)]' : 'text-graphite'
              }`}
            >
              <Pencil size={15} strokeWidth={2} /> הוספה ידנית של עסק
            </button>
          </div>

          {mode === 'file' ? (
            <Card>
              <div
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-hairline rounded-2xl py-16 px-10 text-center cursor-pointer hover:border-brand/40 hover:bg-brand/[0.02] transition-colors max-w-xl mx-auto"
              >
                <span className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
                  <Upload size={24} className="text-brand" strokeWidth={1.8} />
                </span>
                <p className="text-[16px] font-bold text-ink mb-1.5">גרור קובץ אקסל לכאן</p>
                <p className="text-[13px] text-subtle">או לחץ לבחירת קובץ · פורמט xlsx./xls.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  className="hidden"
                />
              </div>
              {parseError && (
                <div className="max-w-xl mx-auto mt-4 px-4 py-3 rounded-lg bg-high/[0.06] border border-high/25 text-[13px] text-high font-semibold text-center">
                  {parseError}
                </div>
              )}
            </Card>
          ) : (
            <Card padded={false}>
              <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-[14.5px]">פרטי העסק שאותר</p>
                  <p className="text-[12px] text-subtle mt-1">מלאו את הפרטים הידועים — שדות עם * הם שדות חובה</p>
                </div>
                <Badge tone="clear" className="shrink-0">יסומן כ&quot;הוזן ידנית&quot;</Badge>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MANUAL_FIELD_DEFS.map(fd => (
                  <div key={fd.key} className={fd.key === 'name' || fd.key === 'address' || fd.key === 'suspicionDetail' ? 'sm:col-span-2' : ''}>
                    <label className="block text-[12.5px] font-semibold text-ink mb-1.5">
                      {fd.label}{fd.required && <span className="text-high"> *</span>}
                    </label>
                    {fd.key === 'neighborhood' ? (
                      <>
                        <Input
                          list="manual-neighborhood-options"
                          value={manual.neighborhood}
                          onChange={e => setManual(m => ({ ...m, neighborhood: e.target.value }))}
                          placeholder="הקלידו או בחרו שכונה"
                          className="w-full"
                        />
                        <datalist id="manual-neighborhood-options">
                          {SORTED_NEIGHBORHOODS.map(n => <option key={n} value={n} />)}
                        </datalist>
                      </>
                    ) : fd.key === 'suspicionRating' ? (
                      <Select value={manual.suspicionRating} onChange={e => setManual(m => ({ ...m, suspicionRating: e.target.value }))} className="w-full">
                        {RATING_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    ) : (
                      <Input
                        value={manual[fd.key]}
                        onChange={e => setManual(m => ({ ...m, [fd.key]: e.target.value }))}
                        placeholder={fd.required ? fd.label : 'אופציונלי'}
                        className="w-full"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 py-3.5 border-t border-hairline bg-canvas flex items-center gap-3">
                <Button onClick={proceedManualToValidate} disabled={!manual.name.trim() || !manual.address.trim() || checking}>
                  {checking ? 'בודק...' : 'המשך לאישור'}
                </Button>
                {submitError && <span className="text-[12.5px] text-high font-semibold">{submitError}</span>}
              </div>
            </Card>
          )}
        </>
      )}

      {step === 'mapping' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          <Card padded={false}>
            <div className="px-5 py-4 border-b border-hairline flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[14.5px]">מיפוי עמודות</p>
                <p className="text-[12px] text-subtle mt-1">המערכת השוותה את כותרות הקובץ לשדות המאגר — בדוק ותקן במידת הצורך</p>
              </div>
              <Badge tone="clear" className="shrink-0">
                זוהו אוטומטית <span className="num">{mappedCount}</span> מתוך <span className="num">{FIELD_DEFS.length}</span>
              </Badge>
            </div>

            <div className="p-3 flex flex-col gap-1 max-h-[520px] overflow-auto">
              {FIELD_DEFS.map(fd => {
                const value = mapping[fd.key]
                const missing = fd.required && !value
                return (
                  <div key={fd.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${missing ? 'bg-mid/[0.06] border border-mid/25' : ''}`}>
                    <span className="w-[150px] shrink-0 text-[13px] font-semibold text-ink">
                      {fd.label}{fd.required && <span className="text-high"> *</span>}
                    </span>
                    <ArrowLeft size={15} className="text-subtle shrink-0" strokeWidth={2} />
                    <Select
                      value={value}
                      onChange={e => setMapping(m => ({ ...m, [fd.key]: e.target.value }))}
                      className="flex-1"
                    >
                      <option value="">— לא ממופה —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </Select>
                    {value ? (
                      <span className="w-5 h-5 rounded-full bg-clear/10 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-clear" strokeWidth={3.2} />
                      </span>
                    ) : missing ? (
                      <span className="w-5 h-5 rounded-full bg-mid/10 flex items-center justify-center shrink-0">
                        <AlertTriangle size={12} className="text-mid" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="w-5 h-5 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-3.5 border-t border-hairline bg-canvas flex items-center gap-3">
              <Button onClick={proceedToValidate} disabled={!mapping.name || !mapping.address || checking}>
                {checking ? 'בודק...' : 'המשך לאימות'}
              </Button>
              {submitError && <span className="text-[12.5px] text-high font-semibold">{submitError}</span>}
            </div>
          </Card>

          <Card>
            <p className="font-bold text-[14.5px] mb-3">תצוגה מקדימה מהקובץ</p>
            <div className="overflow-auto max-h-[420px] text-[12.5px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-start py-2 px-2 font-semibold text-graphite">שם</th>
                    <th className="text-start py-2 px-2 font-semibold text-graphite">כתובת</th>
                    <th className="text-start py-2 px-2 font-semibold text-graphite">דירוג</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {previewRows.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-6 text-subtle">אין נתונים להצגה</td></tr>
                  ) : previewRows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2 font-semibold text-ink">{r.name || '—'}</td>
                      <td className="py-2 px-2 text-charcoal">{r.address || '—'}</td>
                      <td className="py-2 px-2 text-charcoal">{r.rating || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {step === 'validate' && validation && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <Card>
                <p className="font-bold text-[14.5px] mb-3.5">תוצאות האימות</p>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-clear/[0.08]">
                    <span className="w-[30px] h-[30px] rounded-lg bg-clear flex items-center justify-center shrink-0">
                      <Plus size={16} className="text-white" strokeWidth={2.8} />
                    </span>
                    <div>
                      <p className="num text-[18px] font-bold text-clear leading-none">{validation.toAdd.length}</p>
                      <p className="text-[12px] text-charcoal mt-1">נכסים חדשים ייווספו</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-canvas">
                    <span className="w-[30px] h-[30px] rounded-lg bg-graphite flex items-center justify-center shrink-0">
                      <Copy size={15} className="text-white" strokeWidth={2.4} />
                    </span>
                    <div className="flex-1">
                      <p className="num text-[18px] font-bold leading-none">{validation.duplicates}</p>
                      <p className="text-[12px] text-subtle mt-1">כפולים — ידולגו</p>
                    </div>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-high/[0.07]">
                      <span className="w-[30px] h-[30px] rounded-lg bg-high flex items-center justify-center shrink-0">
                        <AlertCircle size={16} className="text-white" strokeWidth={2.6} />
                      </span>
                      <div>
                        <p className="num text-[18px] font-bold text-high leading-none">{errorCount}</p>
                        <p className="text-[12px] text-charcoal mt-1">שורות עם שגיאות — לא ייובאו</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {validation.issues.length > 0 && (
                <Card>
                  <p className="font-bold text-[14.5px] mb-3">שורות שדורשות תשומת לב</p>
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-auto">
                    {validation.issues.slice(0, 8).map((iss, i) => (
                      <div key={i} className={`px-3 py-2.5 rounded-lg border ${iss.kind === 'error' ? 'border-high/25 bg-high/[0.04]' : 'border-mid/25 bg-mid/[0.05]'}`}>
                        <div className="flex items-center gap-2">
                          <Badge tone={iss.kind === 'error' ? 'high' : 'mid'}>שורה {iss.row}</Badge>
                          <span className="text-[12.5px] font-semibold text-ink">{iss.title}</span>
                        </div>
                        <p className="text-[12px] text-subtle mt-1">{iss.detail}</p>
                      </div>
                    ))}
                    {validation.issues.length > 8 && (
                      <p className="text-[12px] text-subtle text-center pt-1">ועוד {validation.issues.length - 8} שורות</p>
                    )}
                  </div>
                </Card>
              )}

              <div className="rounded-xl p-4 bg-brand/[0.05] border border-brand/20 flex items-start gap-3">
                <Info size={17} className="text-brand shrink-0 mt-0.5" strokeWidth={1.9} />
                <div className="flex-1 text-[12.5px] text-ink leading-relaxed">
                  <strong className="font-bold">הקצאה אוטומטית:</strong> שלח את כל הנכסים החדשים בדירוג &quot;גבוה&quot; ישירות לתוכנית העבודה של הסוקר.
                  <div className="flex items-center gap-2.5 mt-2.5">
                    <Toggle checked={autoAssign} onChange={setAutoAssign} />
                    <span className="font-semibold"><span className="num">{highCount}</span> נכסים יוקצו</span>
                  </div>
                </div>
              </div>
            </div>

            <Card padded={false}>
              <div className="px-5 py-4 border-b border-hairline">
                <p className="font-bold text-[14.5px]">נכסים שייווספו</p>
                <p className="text-[12px] text-subtle mt-1">{validation.toAdd.length.toLocaleString('he')} עסקים</p>
              </div>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-canvas">
                    <tr className="border-b border-hairline">
                      {['שם העסק', 'כתובת', 'דירוג'].map(h => (
                        <th key={h} className="text-start px-4 py-2.5 text-[12px] font-semibold text-graphite">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {validation.toAdd.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-8 text-graphite">אין נכסים חדשים להוספה</td></tr>
                    ) : validation.toAdd.slice(0, 100).map(b => (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 font-semibold text-ink">{b.name}</td>
                        <td className="px-4 py-2.5 text-charcoal">{b.address}</td>
                        <td className="px-4 py-2.5"><Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'}>{b.suspicionRating}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Button onClick={confirmUpload} disabled={submitting || validation.toAdd.length === 0}>
              {submitting ? 'מעלה...' : `אישור והעלאת ${validation.toAdd.length} נכסים`}
            </Button>
            <Button variant="secondary" onClick={() => setStep(mode === 'file' ? 'mapping' : 'upload')}>
              {mode === 'file' ? 'חזרה למיפוי' : 'חזרה לעריכת הפרטים'}
            </Button>
            {submitError && <span className="text-[12.5px] text-high font-semibold">{submitError}</span>}
          </div>
        </>
      )}

      {step === 'done' && doneSummary && (
        <Card>
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <span className="w-14 h-14 rounded-full bg-clear/10 flex items-center justify-center">
              <Check size={26} className="text-clear" strokeWidth={3} />
            </span>
            <p className="text-[18px] font-bold text-ink">{mode === 'manual' ? 'העסק נוסף בהצלחה' : 'הקובץ הועלה בהצלחה'}</p>
            <p className="text-[13.5px] text-charcoal max-w-md">
              {mode === 'manual' ? (
                <>נוסף <span className="num font-bold text-ink">{doneSummary.added}</span> עסק חדש למאגר</>
              ) : (
                <>נוספו <span className="num font-bold text-ink">{doneSummary.added}</span> עסקים חדשים מתוך {doneSummary.fileName}</>
              )}
              {doneSummary.skipped > 0 && <> · <span className="num font-bold">{doneSummary.skipped}</span> כפולים דולגו</>}
              {doneSummary.assigned > 0 && <> · <span className="num font-bold text-brand">{doneSummary.assigned}</span> הוקצו אוטומטית לסוקר</>}
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
              <Button href="/">עבור לדשבורד</Button>
              <Button variant="secondary" href="/files">צפה בקבצים</Button>
              <Button variant="ghost" onClick={resetWizard}>{mode === 'manual' ? 'הוסף עסק נוסף' : 'העלה קובץ נוסף'}</Button>
            </div>
          </div>
        </Card>
      )}
    </AppShell>
  )
}
