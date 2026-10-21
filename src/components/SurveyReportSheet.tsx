'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Camera, Check, FileText, Loader2, MapPin, Paperclip, X } from 'lucide-react'
import type { Business, SurveyReport, SurveyReportFile } from '@/lib/types'
import { distanceKm, type LocationMap } from '@/lib/geocode'
import { placementFor } from '@/lib/placement'
import { SURVEY_RESULT_OPTIONS } from '@/lib/surveyStatus'
import {
  MAX_FILES_PER_FIELD, MAX_FILE_BYTES,
  insertReport, uploadReportFile, saveReportFiles, shrinkImage, type ReportDraft,
} from '@/lib/surveyReports'
import { enqueueReport, isNetworkError } from '@/lib/offlineQueue'
import { SuccessCheck } from '@/components/ui'

// The municipality's survey form ("טופס איסוף מידע ונתונים לנכס"), built into
// the surveyor's page: same questions, same order, plus an automatic location
// stamp. Files go to Supabase Storage; the report row to survey_reports.

const SPOKE_WITH = ['בעל/ת הנכס', 'המחזיק/ה בנכס']
const ACTUAL_USE = ['דירת מגורים', 'עסק', 'דירת מגורים ועסק']
const OTHER = 'אחר'
const FAR_WARNING_M = 150
const SAVED_PAUSE_MS = 1100
const SURVEYOR_NAME_KEY = 'survey-report-surveyor-name'
const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

type Group = SurveyReportFile['group']
interface PickedFile { id: string; file: File; preview: string | null }

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise(resolve => {
    // The browser's own timeout doesn't run while a permission prompt is
    // waiting for an answer, so cap the wait here too — the report is never
    // held hostage by the location.
    const giveUp = setTimeout(() => resolve(null), 12000)
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(giveUp); resolve(p) },
      () => { clearTimeout(giveUp); resolve(null) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

export function SurveyReportSheet({ business, locations, onClose, onSaved }: {
  business: Business
  locations: LocationMap
  onClose: () => void
  /** `queued` = no signal: the report waits on the phone and is sent automatically later. */
  onSaved: (report: SurveyReport, queued: boolean) => void
}) {
  const [surveyDate, setSurveyDate] = useState(todayIso)
  const [surveyorName, setSurveyorName] = useState(() => {
    try { return localStorage.getItem(SURVEYOR_NAME_KEY) ?? '' } catch { return '' }
  })
  const [visitedAddress, setVisitedAddress] = useState(business.address)
  const [arnonaNumber, setArnonaNumber] = useState('')
  const [spokeWith, setSpokeWith] = useState('')
  const [spokeWithOther, setSpokeWithOther] = useState('')
  const [actualUse, setActualUse] = useState('')
  const [actualUseOther, setActualUseOther] = useState('')
  const [useDescription, setUseDescription] = useState('')
  const [ownerInfo, setOwnerInfo] = useState('')
  const [extraInfo, setExtraInfo] = useState('')
  const [surveyResult, setSurveyResult] = useState('')
  const [files, setFiles] = useState<Record<Group, PickedFile[]>>({ main: [], extra: [] })

  const [submitting, setSubmitting] = useState(false)
  // Set once the report is safely on the server: the button turns green with a
  // check for a moment, so the surveyor sees it worked before the sheet closes.
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [farWarning, setFarWarning] = useState<{ meters: number; pos: GeolocationPosition } | null>(null)
  // Kept across retries: once the row exists, a retry only re-sends the files
  // that didn't make it, instead of creating a second report.
  const savedReport = useRef<SurveyReport | null>(null)
  const draftRef = useRef<ReportDraft | null>(null)
  const uploaded = useRef<Map<string, SurveyReportFile>>(new Map())

  const propertyPoint = useMemo(() => {
    const placed = placementFor(business, locations)
    return placed.state === 'placed' && placed.kind !== 'neighborhood' ? placed.coords : null
  }, [business, locations])

  // Previews are object URLs — release them when the sheet closes.
  const filesRef = useRef(files)
  useEffect(() => { filesRef.current = files }, [files])
  useEffect(() => () => {
    [...filesRef.current.main, ...filesRef.current.extra].forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
  }, [])

  // Lock the page behind the sheet from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function addFiles(group: Group, list: FileList | null) {
    if (!list?.length) return
    setError(null)
    const room = MAX_FILES_PER_FIELD - files[group].length
    if (list.length > room) setError(`אפשר לצרף עד ${MAX_FILES_PER_FIELD} קבצים בכל שדה.`)
    const picked: PickedFile[] = []
    for (const raw of Array.from(list).slice(0, Math.max(room, 0))) {
      const file = await shrinkImage(raw)
      if (file.size > MAX_FILE_BYTES) { setError(`הקובץ "${raw.name}" גדול מ-10MB ולא צורף.`); continue }
      picked.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
    }
    setFiles(f => ({ ...f, [group]: [...f[group], ...picked] }))
  }

  function removeFile(group: Group, id: string) {
    setFiles(f => {
      const gone = f[group].find(x => x.id === id)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return { ...f, [group]: f[group].filter(x => x.id !== id) }
    })
  }

  const spokeWithValue = spokeWith === OTHER ? spokeWithOther.trim() : spokeWith
  const actualUseValue = actualUse === OTHER ? actualUseOther.trim() : actualUse
  const missing = [
    !surveyDate && 'תאריך סקר',
    !surveyorName.trim() && 'שם הסוקר',
    !visitedAddress.trim() && 'הכתובת שבה ביקרת',
    !actualUseValue && 'השימוש בפועל בנכס',
    !surveyResult && 'תוצאת הסקר',
  ].filter(Boolean) as string[]

  // Puts the report (and whatever wasn't uploaded yet) in the phone's offline
  // queue; it's sent automatically when the connection is back.
  async function queueForLater(draft: ReportDraft) {
    const all = [...files.main.map(f => ['main', f] as const), ...files.extra.map(f => ['extra', f] as const)]
    await enqueueReport({
      businessId: business.id,
      businessName: business.name,
      draft,
      files: all.map(([group, p]) => ({ localId: p.id, file: p.file, name: p.file.name, type: p.file.type, group })),
      serverReport: savedReport.current ?? undefined,
      uploaded: Object.fromEntries(uploaded.current),
    })
    try { localStorage.setItem(SURVEYOR_NAME_KEY, surveyorName.trim()) } catch { /* ignore */ }
    onSaved({ ...(savedReport.current ?? { ...draft, id: '', createdAt: new Date().toISOString() }), files: [] }, true)
  }

  async function submit(confirmedPos?: GeolocationPosition) {
    if (missing.length) { setError(`חסר: ${missing.join(', ')}`); return }
    setSubmitting(true)
    setError(null)
    setFarWarning(null)
    let draft = draftRef.current
    try {
      if (!draft) {
        setProgress('מאתר מיקום…')
        const pos = confirmedPos ?? await getPosition()
        const here = pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : null
        const distanceM = here && propertyPoint ? Math.round(distanceKm(here, propertyPoint) * 1000) : null
        if (!confirmedPos && pos && distanceM !== null && distanceM > FAR_WARNING_M) {
          setFarWarning({ meters: distanceM, pos })
          setSubmitting(false)
          setProgress('')
          return
        }
        draft = {
          businessId: business.id,
          surveyDate,
          surveyorName: surveyorName.trim(),
          visitedAddress: visitedAddress.trim(),
          arnonaPropertyNumber: arnonaNumber.trim(),
          spokeWith: spokeWithValue,
          actualUse: actualUseValue,
          useDescription: useDescription.trim(),
          ownerInfo: ownerInfo.trim(),
          extraInfo: extraInfo.trim(),
          surveyResult: surveyResult as SurveyReport['surveyResult'],
          lat: here?.lat ?? null,
          lon: here?.lon ?? null,
          accuracyM: pos ? Math.round(pos.coords.accuracy) : null,
          distanceM,
        }
        draftRef.current = draft
      }

      if (!navigator.onLine) { await queueForLater(draft); return }

      let report = savedReport.current
      if (!report) {
        setProgress('שומר את הדיווח…')
        report = await insertReport(draft)
        savedReport.current = report
        try { localStorage.setItem(SURVEYOR_NAME_KEY, surveyorName.trim()) } catch { /* ignore */ }
      }

      const queue = ([...files.main.map(f => ['main', f] as const), ...files.extra.map(f => ['extra', f] as const)])
      let i = 0
      for (const [group, picked] of queue) {
        i += 1
        if (uploaded.current.has(picked.id)) continue
        setProgress(`מעלה קובץ ${i} מתוך ${queue.length}…`)
        uploaded.current.set(picked.id, await uploadReportFile(report, picked.file, i, group))
      }
      const records = queue.map(([, p]) => uploaded.current.get(p.id)).filter((r): r is SurveyReportFile => !!r)
      if (records.length) {
        setProgress('מסיים…')
        await saveReportFiles(report.id, records)
      }
      setSaved(true)
      const done = { ...report, files: records }
      setTimeout(() => onSaved(done, false), SAVED_PAUSE_MS)
    } catch (e) {
      if (draft && isNetworkError(e)) {
        try { await queueForLater(draft); return } catch { /* fall through to the error below */ }
      }
      setError(`${e instanceof Error ? e.message : 'השמירה נכשלה'} — לחצו שוב על "שליחת הדיווח" כדי לנסות שוב, שום דבר לא נמחק.`)
      setSubmitting(false)
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-center" role="dialog" aria-modal="true" aria-label="דיווח סקר">
      <div className="w-full max-w-md h-full bg-canvas flex flex-col animate-fade-in">
        <header className="shrink-0 px-4 py-3.5 bg-surface border-b border-hairline flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-subtle">טופס איסוף מידע ונתונים לנכס</p>
            <p className="text-[15.5px] font-bold text-ink truncate">{business.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="סגירה"
            className="w-10 h-10 rounded-full flex items-center justify-center text-charcoal hover:bg-canvas active:scale-90 transition-[background-color,transform] cursor-pointer disabled:opacity-50"
          >
            <X size={19} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <Field n={1} label="תאריך סקר" required>
            <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} className={INPUT} />
          </Field>
          <Field n={2} label="שם הסוקר/חוקר" required>
            <input value={surveyorName} onChange={e => setSurveyorName(e.target.value)} className={INPUT} autoComplete="name" />
          </Field>
          <Field n={3} label="ביקרתי בנכס ברחוב/בית/דירה" required>
            <input value={visitedAddress} onChange={e => setVisitedAddress(e.target.value)} className={INPUT} />
          </Field>
          <Field n={4} label="מספר נכס בארנונה">
            <input value={arnonaNumber} onChange={e => setArnonaNumber(e.target.value)} className={INPUT} inputMode="numeric" />
          </Field>
          <Field n={5} label="שוחחתי עם…">
            <Choices options={SPOKE_WITH} value={spokeWith} onChange={setSpokeWith} other={spokeWithOther} onOther={setSpokeWithOther} />
          </Field>
          <Field n={6} label="מצאתי שהנכס משמש בפועל כ" required>
            <Choices options={ACTUAL_USE} value={actualUse} onChange={setActualUse} other={actualUseOther} onOther={setActualUseOther} />
          </Field>
          <Field n={7} label="השימוש בנכס כפי שאני מזהה" hint="יש לתאר במפורט">
            <textarea value={useDescription} onChange={e => setUseDescription(e.target.value)} rows={4} className={TEXTAREA} />
          </Field>
          <Field n={8} label="מידע על הבעלים והמחזיק בנכס">
            <textarea value={ownerInfo} onChange={e => setOwnerInfo(e.target.value)} rows={3} className={TEXTAREA} />
          </Field>
          <Field n={9} label="מידע נוסף חשוב לנו לדעת">
            <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)} rows={3} className={TEXTAREA} />
          </Field>
          <Field n={10} label="קובץ" hint="עד 10 קבצים, 10MB לקובץ · תמונות מוקטנות אוטומטית">
            <FilePicker items={files.main} onAdd={l => addFiles('main', l)} onRemove={id => removeFile('main', id)} disabled={submitting} />
          </Field>
          <Field n={11} label="קבצים נוספים בהתאם לצורך">
            <FilePicker items={files.extra} onAdd={l => addFiles('extra', l)} onRemove={id => removeFile('extra', id)} disabled={submitting} />
          </Field>
          <Field n={12} label="תוצאת הסקר" hint="נרשמת אוטומטית בעמודת 'תוצאת סקר' של הנכס" required>
            <div className="flex flex-col gap-2">
              {SURVEY_RESULT_OPTIONS.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setSurveyResult(surveyResult === o ? '' : o)}
                  aria-pressed={surveyResult === o}
                  className={`h-11 px-4 rounded-xl border text-[13.5px] font-semibold text-start flex items-center gap-2.5 active:scale-[0.98] transition-[background-color,color,transform] cursor-pointer ${
                    surveyResult === o ? 'bg-brand text-white border-brand' : 'bg-surface text-charcoal border-hairline'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${surveyResult === o ? 'border-white bg-white/30' : 'border-hairline'}`} />
                  {o}
                </button>
              ))}
            </div>
          </Field>
          <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
            <MapPin size={13} strokeWidth={2} /> המיקום שלך נרשם אוטומטית בעת השליחה, כאסמכתא לביקור.
          </p>
        </div>

        <footer className="shrink-0 px-4 pt-3 pb-4 bg-surface border-t border-hairline flex flex-col gap-2">
          {farWarning && (
            <div className="p-3 rounded-lg bg-mid/[0.07] border border-mid/25 text-[12.5px] text-[#7c3a12]">
              נראה שאתה במרחק <strong className="num">{farWarning.meters >= 1000 ? `${(farWarning.meters / 1000).toFixed(1)} ק״מ` : `${farWarning.meters} מ׳`}</strong> מהכתובת של הנכס. לשלוח בכל זאת?
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => submit(farWarning.pos)} className="h-9 px-3.5 rounded-lg bg-mid text-white font-semibold active:scale-95 transition-transform cursor-pointer">כן, לשלוח</button>
                <button type="button" onClick={() => setFarWarning(null)} className="h-9 px-3.5 rounded-lg bg-surface border border-hairline font-semibold active:scale-95 transition-transform cursor-pointer">ביטול</button>
              </div>
            </div>
          )}
          {error && <p className="text-[12.5px] text-high">{error}</p>}
          <button
            type="button"
            onClick={() => submit()}
            disabled={submitting || !!farWarning}
            className={`h-12 rounded-xl text-white text-[14.5px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-[background-color,transform] duration-300 cursor-pointer disabled:cursor-default ${
              saved ? 'bg-clear' : 'bg-brand hover:bg-brand-deep disabled:opacity-70'
            }`}
          >
            {saved
              ? <><SuccessCheck size={22} className="text-white" /> הדיווח נשמר</>
              : submitting ? <><Loader2 size={18} className="animate-spin" /> {progress || 'שולח…'}</> : <><Check size={18} strokeWidth={2.4} /> שליחת הדיווח</>}
          </button>
        </footer>
      </div>
    </div>
  )
}

const INPUT = 'w-full h-11 px-3.5 rounded-lg border border-hairline bg-surface text-[14px] text-ink outline-none focus:border-brand transition-colors'
const TEXTAREA = 'w-full px-3.5 py-2.5 rounded-lg border border-hairline bg-surface text-[14px] text-ink outline-none focus:border-brand transition-colors resize-y leading-relaxed'

function Field({ n, label, hint, required, children }: { n: number; label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[13.5px] font-semibold text-ink mb-1.5">
        <span className="num text-subtle me-1">{n}.</span>{label}{required && <span className="text-high ms-0.5">*</span>}
        {hint && <span className="block text-[11.5px] font-normal text-subtle mt-0.5">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Choices({ options, value, onChange, other, onOther }: {
  options: string[]; value: string; onChange: (v: string) => void; other: string; onOther: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {[...options, OTHER].map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(value === o ? '' : o)}
            aria-pressed={value === o}
            className={`h-10 px-3.5 rounded-full border text-[13px] font-semibold active:scale-95 transition-[background-color,color,transform] cursor-pointer ${
              value === o ? 'bg-brand text-white border-brand' : 'bg-surface text-charcoal border-hairline'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {value === OTHER && (
        <input value={other} onChange={e => onOther(e.target.value)} placeholder="פרטו…" className={INPUT} autoFocus />
      )}
    </div>
  )
}

function FilePicker({ items, onAdd, onRemove, disabled }: {
  items: PickedFile[]; onAdd: (l: FileList | null) => void; onRemove: (id: string) => void; disabled: boolean
}) {
  const full = items.length >= MAX_FILES_PER_FIELD
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className={`flex-1 h-11 rounded-lg border border-dashed border-brand/40 bg-brand/[0.04] text-brand text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${full || disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          <Camera size={16} strokeWidth={2} /> צלם
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { onAdd(e.target.files); e.target.value = '' }} />
        </label>
        <label className={`flex-1 h-11 rounded-lg border border-dashed border-hairline bg-surface text-charcoal text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${full || disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          <Paperclip size={16} strokeWidth={2} /> בחר קבצים
          <input type="file" accept={ACCEPT} multiple className="sr-only" onChange={e => { onAdd(e.target.files); e.target.value = '' }} />
        </label>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {items.map(f => (
            <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-surface border border-hairline">
              {f.preview
                // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview
                ? <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-subtle"><FileText size={18} /><span className="text-[9.5px] leading-tight text-center break-all line-clamp-2">{f.file.name}</span></div>}
              {!disabled && (
                <button type="button" onClick={() => onRemove(f.id)} aria-label={`הסר ${f.file.name}`} className="absolute top-1 end-1 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center cursor-pointer">
                  <X size={13} strokeWidth={2.4} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
