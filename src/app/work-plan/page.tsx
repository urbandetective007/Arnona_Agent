'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ClipboardEdit, ExternalLink, Loader2, LocateFixed, LogOut, MapPin, Navigation, Route, ScanEye } from 'lucide-react'
import { useRequireRole } from '@/lib/useRequireRole'
import { logout } from '@/lib/auth'
import type { Business } from '@/lib/types'
import { splitLink, siteAddressMismatch } from '@/lib/links'
import { useBusinesses } from '@/lib/useBusinesses'
import { Badge, Skeleton, toast } from '@/components/ui'
import { formatDate } from '@/lib/dateUtils'
import { distanceKm, type LocationMap } from '@/lib/geocode'
import { fetchLocations } from '@/lib/locations'
import { placementFor, neighborhoodOf, streetViewUrl } from '@/lib/placement'
import { fetchReportsByBusiness } from '@/lib/surveyReports'
import { flushQueue, listQueued, onQueueChange } from '@/lib/offlineQueue'
import { SurveyReportSheet } from '@/components/SurveyReportSheet'
import { InstallLink } from '@/components/PwaSetup'
import type { BadgeTone } from '@/components/ui'

const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid', 'לא חשוד': 'clear' }
const NO_NEIGHBORHOOD = 'ללא שכונה משויכת'
const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']

// The survey form is built in (SurveyReportSheet). The municipality's
// Microsoft Forms version stays linked as a fallback during the transition.
const SURVEY_FORM_URL = 'https://forms.cloud.microsoft/r/vGwE8SGUAR'

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

// Google Maps directions with the stops in order. No origin, so Google starts
// from the phone's own location. Google takes at most 9 waypoints + 1 destination.
const MAX_ROUTE_STOPS = 10
function routeUrl(addresses: string[]): string {
  const withCity = addresses.map(a => (a.includes('ירושלים') ? a : `${a}, ירושלים`))
  const destination = withCity[withCity.length - 1]
  const waypoints = withCity.slice(0, -1)
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${encodeURIComponent(destination)}`
  if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`
  return url
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.max(Math.round(km * 1000 / 10) * 10, 10)} מ׳` : `${km.toFixed(1)} ק״מ`
}

type Pt = { lat: number; lon: number }

const CHECKED_STORAGE_KEY = 'work-plan-checked'
const NEARBY_STORAGE_KEY = 'work-plan-nearby'

function loadChecked(): Set<string> {
  try {
    const raw = localStorage.getItem(CHECKED_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export default function WorkPlanPage() {
  const ready = useRequireRole(['surveyor'])
  const router = useRouter()
  const { businesses, loading } = useBusinesses()
  // Every neighborhood starts closed; the surveyor opens the one they're in.
  const [openNeighborhood, setOpenNeighborhood] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  // "Nearest to me": the phone's position (null while off) and stored address
  // coordinates. A property without stored coordinates falls back to its
  // neighborhood's center.
  const [myPos, setMyPos] = useState<Pt | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState(false)
  const [locations, setLocations] = useState<LocationMap>({})
  // Properties with a field report are done for the surveyor even before the
  // office sets their result. null = still loading.
  const [reportedIds, setReportedIds] = useState<Set<string> | null>(null)
  const [reportFor, setReportFor] = useState<Business | null>(null)
  // Reports filled in without signal, waiting on the phone to be sent.
  const [queuedCount, setQueuedCount] = useState(0)
  const [sendingQueued, setSendingQueued] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const refresh = () => { listQueued().then(q => setQueuedCount(q.length)) }
    const send = async () => {
      setOnline(navigator.onLine)
      if (!navigator.onLine) return
      setSendingQueued(true)
      const sent = await flushQueue()
      setSendingQueued(false)
      if (sent > 0) toast(sent === 1 ? 'דיווח שחיכה לקליטה נשלח' : `${sent} דיווחים שחיכו לקליטה נשלחו`)
    }
    const goOffline = () => setOnline(false)
    refresh()
    send()
    const off = onQueueChange(refresh)
    window.addEventListener('online', send)
    window.addEventListener('offline', goOffline)
    return () => { off(); window.removeEventListener('online', send); window.removeEventListener('offline', goOffline) }
  }, [])
  const [today] = useState(() => new Date())
  // `checked` is live — it drives the checkmark itself and updates the
  // instant you tap one. `checkedAtLoad` is a snapshot taken once when the
  // page loads and never touched again afterward: the neighborhood/property
  // ordering below is sorted from that frozen snapshot, so ticking things
  // off doesn't yank the list out from under your finger mid-round — a
  // completed item only sinks to the bottom the next time the page loads.
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [checkedAtLoad, setCheckedAtLoad] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loaded = loadChecked()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount, not a cascading update
    setChecked(loaded)
    setCheckedAtLoad(loaded)
  }, [])

  useEffect(() => {
    // Sent reports + those waiting on the phone for signal both count as done.
    Promise.all([fetchReportsByBusiness().catch(() => new Map()), listQueued()])
      .then(([m, queued]) => setReportedIds(new Set([...m.keys(), ...queued.map(q => q.businessId)])))
  }, [])

  useEffect(() => {
    fetchLocations().then(setLocations).catch(() => { /* sorting falls back to neighborhood centers */ })
  }, [])

  function locate() {
    if (!('geolocation' in navigator)) { setLocateError(true); return }
    setLocating(true)
    setLocateError(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setMyPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
        try { localStorage.setItem(NEARBY_STORAGE_KEY, '1') } catch { /* ignore */ }
      },
      () => {
        setLocating(false)
        setLocateError(true)
        try { localStorage.removeItem(NEARBY_STORAGE_KEY) } catch { /* ignore */ }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  function toggleNearby() {
    if (myPos) {
      setMyPos(null)
      try { localStorage.removeItem(NEARBY_STORAGE_KEY) } catch { /* ignore */ }
    } else {
      locate()
    }
  }

  // Turned on last visit → permission was already given, so ask again silently.
  useEffect(() => {
    let on = false
    try { on = localStorage.getItem(NEARBY_STORAGE_KEY) === '1' } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a saved preference on mount
    if (on) locate()
  }, [])

  function persistChecked(next: Set<string>) {
    setChecked(next)
    try { localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
  }

  function toggleChecked(id: string) {
    const next = new Set(checked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    persistChecked(next)
  }

  function toggleNeighborhoodChecked(list: Business[]) {
    const allChecked = list.every(b => checked.has(b.id))
    const next = new Set(checked)
    list.forEach(b => { if (allChecked) next.delete(b.id); else next.add(b.id) })
    persistChecked(next)
  }

  const pending = useMemo(
    () => businesses.filter(b => b.sentToInspector === 'נשלח לסוקר' && !b.surveyResultDetail && !reportedIds?.has(b.id)),
    [businesses, reportedIds]
  )

  // Distance (km) from the surveyor to each pending property, while "nearest
  // to me" is on.
  const distanceById = useMemo(() => {
    const m = new Map<string, number>()
    if (!myPos) return m
    pending.forEach(b => {
      const placed = placementFor(b, locations)
      const pt = placed.state === 'placed' ? placed.coords : neighborhoodOf(b)?.center
      if (pt) m.set(b.id, distanceKm(myPos, pt))
    })
    return m
  }, [pending, locations, myPos])
  const dist = (id: string) => distanceById.get(id) ?? Infinity

  const groups = useMemo(() => {
    const byNeighborhood = new Map<string, Business[]>()
    pending.forEach(b => {
      const key = b.neighborhood || NO_NEIGHBORHOOD
      const list = byNeighborhood.get(key) ?? []
      list.push(b)
      byNeighborhood.set(key, list)
    })
    return [...byNeighborhood.entries()]
      .map(([name, list]): [string, Business[]] => [
        name,
        [...list].sort((a, b) => {
          const aDone = checkedAtLoad.has(a.id) ? 1 : 0
          const bDone = checkedAtLoad.has(b.id) ? 1 : 0
          return aDone - bDone || (myPos ? dist(a.id) - dist(b.id) : 0) || a.name.localeCompare(b.name, 'he')
        }),
      ])
      .sort((a, b) => {
        const aDone = a[1].every(x => checkedAtLoad.has(x.id)) ? 1 : 0
        const bDone = b[1].every(x => checkedAtLoad.has(x.id)) ? 1 : 0
        const near = myPos ? nearestKm(a[1]) - nearestKm(b[1]) : 0
        return aDone - bDone || near || b[1].length - a[1].length || a[0].localeCompare(b[0], 'he')
      })
    function nearestKm(list: Business[]) {
      return Math.min(...list.map(x => dist(x.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dist only reads distanceById
  }, [pending, checkedAtLoad, distanceById, myPos])

  const doneCount = pending.filter(b => checked.has(b.id)).length
  const donePct = pending.length > 0 ? Math.round((doneCount / pending.length) * 100) : 0

  if (!ready) return null

  if (loading || reportedIds === null) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center">
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="h-[150px] bg-chrome" />
          <div className="px-3.5 flex flex-col gap-3">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[68px] rounded-2xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex justify-center">
      <div className="w-full max-w-md flex flex-col min-h-screen bg-canvas">
        <header
          className="shrink-0 px-5 pb-4"
          style={{ background: 'linear-gradient(165deg, var(--color-chrome) 0%, #123256 100%)', paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px]" style={{ color: '#8fa8c8' }}>
                {DAY_NAMES[today.getDay()]} · <span className="num">{today.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}</span>
              </p>
              <p className="text-white text-[21px] font-bold mt-0.5 tracking-tight">תוכנית העבודה שלך</p>
            </div>
            <button
              type="button"
              onClick={async () => { setLoggingOut(true); await logout(); router.push('/login') }}
              disabled={loggingOut}
              aria-label="יציאה"
              title="יציאה"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/10 text-[#cfe0ff] hover:bg-white/20 hover:text-white active:scale-90 active:bg-white/25 transition-[background-color,color,transform] duration-150 cursor-pointer disabled:cursor-default disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-white/60"
            >
              {loggingOut ? <Loader2 size={17} strokeWidth={1.9} className="animate-spin" /> : <LogOut size={17} strokeWidth={1.9} />}
            </button>
          </div>

          <div className="mt-4 rounded-[13px] p-3.5" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center gap-4">
              <div>
                <p className="num text-white text-[19px] font-bold leading-none">{pending.length}</p>
                <p className="text-[11.5px] mt-1" style={{ color: '#8fa8c8' }}>נכסים</p>
              </div>
              <div className="w-px h-6 shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }} />
              <div>
                <p className="num text-white text-[19px] font-bold leading-none">{groups.length}</p>
                <p className="text-[11.5px] mt-1" style={{ color: '#8fa8c8' }}>שכונות</p>
              </div>
              <div className="w-px h-6 shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }} />
              <div>
                <p className="num text-white text-[19px] font-bold leading-none">{doneCount}</p>
                <p className="text-[11.5px] mt-1" style={{ color: '#8fa8c8' }}>בוצעו</p>
              </div>
            </div>
            {pending.length > 0 && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <span className="bar-grow block h-full rounded-full bg-clear transition-[width] duration-500 ease-out" style={{ width: `${donePct}%` }} />
                </div>
                <p className="text-[11.5px] mt-1.5" style={{ color: '#8fa8c8' }}>
                  <span className="num font-semibold text-white">{doneCount}</span> מתוך <span className="num">{pending.length}</span> בוצעו ({donePct}%)
                </p>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-3.5 pt-3.5 pb-8 flex flex-col gap-3">
          {!online && (
            <div className="px-3.5 py-2.5 rounded-xl bg-ink text-white text-[12.5px] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-mid shrink-0" />
              אין קליטה כרגע — אפשר להמשיך לעבוד ולמלא דיווחים, הם יישלחו כשהקליטה תחזור.
            </div>
          )}
          {queuedCount > 0 && (
            <div className="px-3.5 py-2.5 rounded-xl bg-mid/[0.08] border border-mid/25 text-[12.5px] text-[#7c3a12] flex items-center gap-2.5">
              <span className="flex-1">
                <strong className="num">{queuedCount}</strong> {queuedCount === 1 ? 'דיווח ממתין' : 'דיווחים ממתינים'} לשליחה — יישלחו אוטומטית כשתהיה קליטה.
              </span>
              <button
                type="button"
                disabled={sendingQueued || !online}
                onClick={async () => {
                  setSendingQueued(true)
                  const sent = await flushQueue()
                  setSendingQueued(false)
                  toast(sent > 0 ? `${sent} ${sent === 1 ? 'דיווח נשלח' : 'דיווחים נשלחו'}` : 'עדיין אין חיבור — ננסה שוב אוטומטית', sent > 0 ? 'success' : 'info')
                }}
                className="shrink-0 h-8 px-3 rounded-lg bg-mid text-white font-semibold active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
              >
                {sendingQueued ? <Loader2 size={14} className="animate-spin" /> : 'שלח עכשיו'}
              </button>
            </div>
          )}
          {groups.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={toggleNearby}
                disabled={locating}
                aria-pressed={!!myPos}
                className={`self-start h-9 px-3.5 rounded-full border text-[12.5px] font-semibold flex items-center gap-1.5 active:scale-95 transition-[background-color,color,transform] duration-150 cursor-pointer ${
                  myPos ? 'bg-brand text-white border-brand' : 'bg-surface text-charcoal border-hairline hover:border-brand/40 hover:text-brand'
                }`}
              >
                {locating ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <LocateFixed size={15} strokeWidth={2} />}
                {locating ? 'מאתר מיקום…' : myPos ? 'ממוין לפי קרוב אליי' : 'מיין לפי קרוב אליי'}
              </button>
              {locateError && (
                <p className="text-[12px] text-high">לא הצלחנו לקבל מיקום — בדקו שהרשאת המיקום פעילה בטלפון.</p>
              )}
            </div>
          )}
          {groups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-subtle text-[14px] text-center px-6">
              אין נכסים הממתינים לסקר כרגע
            </div>
          ) : groups.map(([neighborhood, list], groupIndex) => {
            const open = openNeighborhood === neighborhood
            const neighborhoodChecked = list.every(b => checked.has(b.id))
            const hoodDone = list.filter(b => checked.has(b.id)).length
            const hoodNearest = myPos ? Math.min(...list.map(b => dist(b.id))) : Infinity
            const routeStops = list.filter(b => !checked.has(b.id) && b.address)
            return (
              <div
                key={neighborhood}
                style={{ ['--i' as string]: Math.min(groupIndex, 12) }}
                className={`row-in bg-surface rounded-2xl overflow-hidden border-2 transition-colors ${
                  open ? 'border-brand/25 shadow-[0_2px_8px_rgba(2,74,216,0.08)]' : 'border-transparent shadow-[0_1px_3px_rgba(15,26,40,0.06)]'
                }`}
              >
                <div className={`flex items-center gap-2.5 px-4 py-3.5 ${open ? 'bg-brand/[0.04] border-b border-hairline' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleNeighborhoodChecked(list)}
                    aria-label={neighborhoodChecked ? 'בטל סימון כל נכסי השכונה' : 'סמן את כל נכסי השכונה כבוצעו'}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-[background-color,border-color,transform] active:scale-90 cursor-pointer ${
                      neighborhoodChecked ? 'bg-clear border-clear' : 'border-hairline'
                    }`}
                  >
                    {neighborhoodChecked && <Check size={13} className="text-white" strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenNeighborhood(open ? null : neighborhood)}
                    aria-expanded={open}
                    className="flex-1 min-w-0 text-start flex items-center gap-2.5 cursor-pointer"
                  >
                    <span className="w-[34px] h-[34px] rounded-[10px] bg-high/10 flex items-center justify-center shrink-0">
                      <MapPin size={16} className="text-high" strokeWidth={2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-ink">{neighborhood}</p>
                      <p className="num text-[12px] text-subtle mt-0.5">
                        {list.length.toLocaleString('he')} נכסים
                        {hoodDone > 0 && <span className="text-clear font-semibold"> · {hoodDone} בוצעו</span>}
                        {Number.isFinite(hoodNearest) && <span> · {formatDistance(hoodNearest)}</span>}
                      </p>
                    </div>
                    <ChevronDown size={17} className={`text-subtle shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.1} />
                  </button>
                </div>

                {open && (
                  <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
                    {routeStops.length > 1 && (
                      <a
                        href={routeUrl(routeStops.slice(0, MAX_ROUTE_STOPS).map(b => b.address))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 h-10 rounded-xl bg-brand/[0.07] text-brand text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-brand/[0.12] active:scale-[0.98] transition-[background-color,transform]"
                      >
                        <Route size={16} strokeWidth={2} />
                        נווט לכל השכונה
                        <span className="num text-[11.5px] font-normal text-brand/80">
                          ({routeStops.length > MAX_ROUTE_STOPS ? `${MAX_ROUTE_STOPS} הכתובות הראשונות` : `${routeStops.length} עצירות`})
                        </span>
                      </a>
                    )}
                    {/* Google Maps sometimes drops the route when the link cold-starts the app; a second tap works. */}
                    {routeStops.length > 1 && (
                      <p className="text-[11px] text-subtle text-center">אם המסלול לא מוצג בגוגל מפות — חזרו ולחצו שוב</p>
                    )}
                    {list.map((b, rowIndex) => {
                      const isChecked = checked.has(b.id)
                      const expanded = expandedId === b.id
                      const km = distanceById.get(b.id)
                      const links = [b.link1, b.link2, b.link3].map(splitLink).filter(l => l.url)
                      return (
                        <div key={b.id} className="row-in rounded-xl bg-canvas" style={{ ['--i' as string]: Math.min(rowIndex, 12) }}>
                          <div className="flex items-center gap-2.5 px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => toggleChecked(b.id)}
                              aria-label={isChecked ? 'בטל סימון' : 'סמן כבוצע'}
                              className={`w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center shrink-0 transition-[background-color,border-color,transform] active:scale-90 cursor-pointer ${
                                isChecked ? 'bg-clear border-clear' : 'border-hairline'
                              }`}
                            >
                              {isChecked && <Check size={13} className="text-white" strokeWidth={3} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : b.id)}
                              aria-expanded={expanded}
                              className="flex-1 min-w-0 text-start cursor-pointer"
                            >
                              <p className="text-[14px] font-semibold text-ink truncate flex items-center gap-1">
                                <span className="truncate">{b.name}</span>
                                <ChevronDown size={14} className={`text-subtle shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} strokeWidth={2.2} />
                              </p>
                              <p className="text-[12.5px] text-subtle mt-0.5 truncate">
                                {b.address}
                                {km !== undefined && <span className="num"> · {formatDistance(km)}</span>}
                              </p>
                            </button>
                            {b.suspicionRating && (
                              <Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'} className="shrink-0">{b.suspicionRating}</Badge>
                            )}
                            {b.address && (
                              <a
                                href={mapsUrl(b.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-11 h-11 rounded-[11px] bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-light active:scale-90 transition-[background-color,transform]"
                                aria-label={`נווט אל ${b.name}`}
                              >
                                <Navigation size={17} strokeWidth={2} />
                              </a>
                            )}
                          </div>

                          {expanded && (
                            <div className="mx-2 mb-2 p-3 rounded-lg bg-surface border border-hairline flex flex-col gap-2 text-[12.5px]">
                              {b.type && <DetailRow label="סוג עסק">{b.type}</DetailRow>}
                              {b.suspicionDetail && <DetailRow label="סיבת החשד"><span className="whitespace-pre-line">{b.suspicionDetail}</span></DetailRow>}
                              {b.unitCount && <DetailRow label="יחידות בכתובת"><span className="num">{b.unitCount}</span></DetailRow>}
                              {b.matchedAddress && b.matchedAddress !== b.address && <DetailRow label="כתובת שזוהתה">{b.matchedAddress}</DetailRow>}
                              {b.uploadDate && <DetailRow label="נוסף"><span className="num">{formatDate(b.uploadDate)}</span></DetailRow>}
                              {links.map((link, i) => link.siteAddress && (
                                <DetailRow key={i} label={`כתובת בקישור ${i + 1}`}>
                                  <span className={siteAddressMismatch(link.siteAddress, b.address) ? 'text-high font-semibold' : ''}>{link.siteAddress}</span>
                                </DetailRow>
                              ))}
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {b.address && (
                                  <a
                                    href={streetViewUrl(b, locations)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-7 px-2.5 rounded-full bg-brand text-white text-[12px] font-semibold flex items-center gap-1 hover:bg-brand-deep active:scale-95 transition-[background-color,transform]"
                                  >
                                    <ScanEye size={13} strokeWidth={2} />
                                    תמונת רחוב
                                  </a>
                                )}
                                  {links.map((link, i) => (
                                    <a
                                      key={i}
                                      href={link.url}
                                      title={link.siteAddress ? `כתובת בקישור: ${link.siteAddress}` : undefined}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="h-7 px-2.5 rounded-full bg-brand/[0.07] text-brand text-[12px] font-semibold flex items-center gap-1 hover:bg-brand/[0.12] active:scale-95 transition-[background-color,transform]"
                                    >
                                      <ExternalLink size={12} strokeWidth={2} />
                                      קישור {i + 1}
                                    </a>
                                  ))}
                              </div>
                            </div>
                          )}

                          <div className="px-2 pb-2">
                            <button
                              type="button"
                              onClick={() => setReportFor(b)}
                              className="w-full h-10 rounded-lg bg-surface border border-brand/30 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand hover:bg-brand/[0.04] active:scale-[0.98] transition-[background-color,transform] cursor-pointer"
                            >
                              <ClipboardEdit size={15} strokeWidth={1.9} />
                              מילוי דיווח סקר
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {groups.length > 0 && (
            <a href={SURVEY_FORM_URL} target="_blank" rel="noopener noreferrer" className="self-center mt-2 text-[11.5px] text-subtle underline underline-offset-2">
              הטופס החיצוני (מיקרוסופט) עדיין זמין
            </a>
          )}
          <p className="self-center mt-1 text-[11px] text-subtle num">גרסה {process.env.APP_VERSION} · {process.env.APP_BUILD_DATE}</p>
          <InstallLink className="self-center text-[12px] font-semibold text-brand" />
        </main>
      </div>

      {reportFor && (
        <SurveyReportSheet
          business={reportFor}
          locations={locations}
          onClose={() => setReportFor(null)}
          onSaved={(report, queued) => {
            setReportedIds(prev => new Set(prev).add(report.businessId))
            if (queued) {
              setReportFor(null)
              toast(`אין קליטה — הדיווח על ${reportFor.name} נשמר בטלפון ויישלח אוטומטית`, 'info')
              return
            }
            setReportFor(null)
            toast(`הדיווח על ${reportFor.name} נשמר`)
          }}
        />
      )}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-[86px] shrink-0 text-subtle">{label}</span>
      <span className="flex-1 min-w-0 text-ink">{children}</span>
    </div>
  )
}
