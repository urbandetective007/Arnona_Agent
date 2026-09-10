'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ClipboardEdit, LogOut, MapPin, Navigation } from 'lucide-react'
import { useRequireRole } from '@/lib/useRequireRole'
import { logout } from '@/lib/auth'
import type { Business } from '@/lib/types'
import { supabase, dbToBusiness } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/cache'
import { Badge, Spinner } from '@/components/ui'
import type { BadgeTone } from '@/components/ui'

const RATING_TONE: Record<string, BadgeTone> = { 'גבוה': 'high', 'בינוני': 'mid', 'לא חשוד': 'clear' }
const NO_NEIGHBORHOOD = 'ללא שכונה משויכת'
const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']

// The surveyor reports findings on the municipality's own Microsoft Forms
// form (an external process this app doesn't replace) — this button just
// gets them there. See the code comment above SURVEY_FORM_URL's usage for
// how to add address/name/date pre-fill once a prefilled-link template is
// available from that form.
const SURVEY_FORM_URL = 'https://forms.cloud.microsoft/r/vGwE8SGUAR'

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export default function WorkPlanPage() {
  const ready = useRequireRole(['employee', 'surveyor'])
  const router = useRouter()
  // Reading sessionStorage in a lazy useState initializer would give the
  // server (build-time prerender) and the client's first paint different
  // values, since sessionStorage doesn't exist on the server — a hydration
  // mismatch. Starting empty on both sides and hydrating from cache inside
  // an effect (client-only) keeps the very first render identical.
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [openNeighborhood, setOpenNeighborhood] = useState<string | null | undefined>(undefined)
  const [today] = useState(() => new Date())

  useEffect(() => {
    const cached = getCache<Business[]>('businesses')
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setBusinesses(cached)
      setLoading(false)
    }
    supabase.from('businesses').select('*').then(({ data }) => {
      if (data) { const b = data.map(dbToBusiness); setBusinesses(b); setCache('businesses', b) }
      setLoading(false)
    })
  }, [])

  const pending = useMemo(
    () => businesses.filter(b => b.sentToInspector === 'נשלח לסוקר' && !b.surveyResultDetail),
    [businesses]
  )

  const groups = useMemo(() => {
    const byNeighborhood = new Map<string, Business[]>()
    pending.forEach(b => {
      const key = b.neighborhood || NO_NEIGHBORHOOD
      const list = byNeighborhood.get(key) ?? []
      list.push(b)
      byNeighborhood.set(key, list)
    })
    return [...byNeighborhood.entries()]
      .map(([name, list]): [string, Business[]] => [name, [...list].sort((a, b) => a.name.localeCompare(b.name, 'he'))])
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'he'))
  }, [pending])

  const effectiveOpen = openNeighborhood !== undefined ? openNeighborhood : (groups[0]?.[0] ?? null)
  const nextStop = groups[0]?.[1]?.[0]

  if (!ready) return null

  if (loading) {
    return (
      <div className="min-h-screen flex bg-canvas">
        <Spinner fullHeight />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex justify-center">
      <div className="w-full max-w-md flex flex-col min-h-screen bg-canvas">
        <header
          className="shrink-0 px-5 pt-6 pb-4"
          style={{ background: 'linear-gradient(165deg, var(--color-chrome) 0%, #123256 100%)' }}
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
              onClick={async () => { await logout(); router.push('/login') }}
              aria-label="יציאה"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.10)', color: '#cfe0ff' }}
            >
              <LogOut size={17} strokeWidth={1.9} />
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
              {nextStop && nextStop.address && (
                <a
                  href={mapsUrl(nextStop.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-auto w-10 h-10 rounded-[11px] bg-brand flex items-center justify-center shrink-0"
                  aria-label={`נווט אל ${nextStop.name}`}
                >
                  <Navigation size={17} className="text-white" strokeWidth={2} />
                </a>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-3.5 pt-3.5 pb-8 flex flex-col gap-3">
          {groups.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-subtle text-[14px] text-center px-6">
              אין נכסים הממתינים לסקר כרגע
            </div>
          ) : groups.map(([neighborhood, list]) => {
            const open = effectiveOpen === neighborhood
            return (
              <div
                key={neighborhood}
                className={`bg-surface rounded-2xl overflow-hidden border-2 transition-colors ${
                  open ? 'border-brand/25 shadow-[0_2px_8px_rgba(2,74,216,0.08)]' : 'border-transparent shadow-[0_1px_3px_rgba(15,26,40,0.06)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenNeighborhood(open ? null : neighborhood)}
                  className={`w-full text-start px-4 py-3.5 flex items-center gap-2.5 ${open ? 'bg-brand/[0.04] border-b border-hairline' : ''}`}
                >
                  <span className="w-[34px] h-[34px] rounded-[10px] bg-high/10 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-high" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-ink">{neighborhood}</p>
                    <p className="num text-[12px] text-subtle mt-0.5">{list.length.toLocaleString('he')} נכסים</p>
                  </div>
                  <ChevronDown size={17} className={`text-subtle shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.1} />
                </button>

                {open && (
                  <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
                    {list.map((b, i) => {
                      const isNext = b.id === nextStop?.id
                      return (
                        <div key={b.id} className={`rounded-xl ${isNext ? 'bg-brand/[0.06] ring-1 ring-brand/20' : 'bg-canvas'}`}>
                          <div className="flex items-center gap-2.5 px-2 py-2.5">
                            <span
                              className={`num w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[11.5px] font-bold shrink-0 ${
                                isNext ? 'border-brand text-brand' : 'border-hairline text-subtle'
                              }`}
                            >
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-semibold text-ink truncate">{b.name}</p>
                              <p className="text-[12.5px] text-subtle mt-0.5 truncate">{b.address}</p>
                            </div>
                            {b.suspicionRating && (
                              <Badge tone={RATING_TONE[b.suspicionRating] ?? 'neutral'} className="shrink-0">{b.suspicionRating}</Badge>
                            )}
                            {b.address && (
                              <a
                                href={mapsUrl(b.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 ${
                                  isNext ? 'bg-brand text-white' : 'border-[1.5px] border-hairline text-charcoal'
                                }`}
                                aria-label={`נווט אל ${b.name}`}
                              >
                                <Navigation size={17} strokeWidth={2} />
                              </a>
                            )}
                          </div>

                          <div className="px-2 pb-2">
                            <a
                              href={SURVEY_FORM_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-9 rounded-lg border border-hairline bg-surface flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-charcoal hover:border-[#c7d1de] transition-colors"
                            >
                              <ClipboardEdit size={14} strokeWidth={1.9} />
                              מילוי דיווח סקר
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </main>
      </div>
    </div>
  )
}
