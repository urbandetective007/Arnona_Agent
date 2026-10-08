'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Business } from '@/lib/types'
import { cleanAddress, isInCity, type LocationMap } from '@/lib/geocode'
import type { GeocodeQueue, GeocodeItem } from '@/lib/geocodeQueue'
import { fetchLocations, saveLocations, createLocationQueue } from '@/lib/locations'
import { placementFor, neighborhoodOf, type Placement, type PlacementKind } from '@/lib/placement'
import { CITY, MAP_CENTER } from '@/lib/city'

interface JerusalemMapProps {
  businesses: Business[]
  /** Employees can correct a location by hand; managers only view. */
  canEdit?: boolean
  /** Address key (cleanAddress) to start correcting right away, from /map?fix=… */
  fixKey?: string | null
}

// Locations used to be kept in a static file and in each browser's
// localStorage; they now live in the Supabase table address_locations.
const OLD_BROWSER_CACHE_KEYS = ['arnona_live_geocode_cache_v1', 'arnona_live_geocode_cache_v2']

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? esc(u) : '')

// Suspicion colors mapping
const SUSPICION_COLORS: Record<string, string> = {
  'גבוה': '#ef4444',      // Red
  'בינוני': '#f97316',     // Orange
  'דרוש בדיקה': '#3b82f6', // Blue
  'לא חשוד': '#22c55e',    // Green
}

const DEFAULT_COLOR = '#9ca3af' // Gray

// SVG marker creator function
// `uncertain` adds an amber "!" badge — the pin marks the property's
// neighborhood rather than its building, or sits far from its neighborhood.
const createMarkerIcon = (color: string, uncertain = false) => {
  return L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/>
        ${uncertain ? `
        <circle cx="18.5" cy="5" r="4.6" fill="#f59e0b" stroke="#fff" stroke-width="1.2"/>
        <text x="18.5" y="7.3" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff" font-family="Arial, sans-serif">!</text>
        ` : ''}
      </svg>
    `,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}


// Fix marker: a large blue pin the employee drags to the right spot.
const createFixIcon = () =>
  L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44" style="filter: drop-shadow(0px 3px 6px rgba(2,74,216,0.45));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#024ad8" stroke="#fff" stroke-width="1"/>
        <circle cx="12" cy="9" r="3" fill="#fff"/>
      </svg>
    `,
    className: 'custom-leaflet-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  })

interface PopupInfo {
  kind: PlacementKind
  suspiciousKm: number | null
  neighborhood: string | null
  /** Businesses sharing this address (a fix applies to all of them). */
  sameAddress: number
}

const noteStyle = 'margin: 0 0 8px 0; font-size: 11px; color: #92400e; line-height: 1.35; background: #fffbeb; border: 1px solid #fcd34d; padding: 6px; border-radius: 4px;'

function popupHtml(b: Business, info: PopupInfo, canEdit: boolean): string {
  const { kind, suspiciousKm } = info
  return `
      <div style="font-family: var(--font-manrope), sans-serif; text-align: right; direction: rtl; min-width: 200px;">
        <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: var(--ink);">${esc(b.name)}</h3>
        ${kind === 'neighborhood' ? `
        <p style="${noteStyle}">
          <strong>מיקום משוער:</strong> הרחוב לא אותר במפה, והנקודה מוצגת במרכז השכונה${info.neighborhood ? ` (${esc(info.neighborhood)})` : ''}. אפשר לקבוע את המיקום ידנית.
        </p>
        ` : ''}
        ${suspiciousKm !== null ? `
        <p style="${noteStyle}">
          <strong>מיקום לא ודאי:</strong> הנקודה רחוקה כ-${suspiciousKm.toFixed(1)} ק״מ ממרכז השכונה הרשומה${info.neighborhood ? ` (${esc(info.neighborhood)})` : ''} — ייתכן רחוב באותו שם בחלק אחר של העיר. כדאי לאמת.
        </p>
        ` : ''}
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>סוג עסק:</strong> ${esc(b.type || 'לא ידוע')}
        </p>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>כתובת:</strong> ${esc(b.address)}
        </p>
        ${kind === 'street' ? `
        <p style="margin: 0 0 4px 0; font-size: 11px; color: var(--graphite);">מיקום לפי הרחוב (מספר הבית לא אותר במפה)</p>
        ` : ''}
        ${kind === 'manual' ? `
        <p style="margin: 0 0 4px 0; font-size: 11px; color: var(--graphite);">המיקום נקבע ידנית</p>
        ` : ''}
        ${b.neighborhood ? `
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>שכונה:</strong> ${esc(b.neighborhood)}
        </p>
        ` : ''}
        <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--charcoal);">
          <strong>כתובת עירייה:</strong> ${esc(b.matchedAddress || 'לא נמצאה')}
        </p>
        <div style="margin-bottom: 8px;">
          <span style="
            display: inline-block;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            color: ${b.suspicionRating === 'גבוה' ? '#b91c1c' : b.suspicionRating === 'בינוני' ? '#c2410c' : b.suspicionRating === 'לא חשוד' ? '#15803d' : '#4b5563'};
            background-color: ${b.suspicionRating === 'גבוה' ? '#fef2f2' : b.suspicionRating === 'בינוני' ? '#fff7ed' : b.suspicionRating === 'לא חשוד' ? '#f0fdf4' : '#f3f4f6'};
          ">
            ${esc(b.suspicionRating)}
          </span>
        </div>
        ${b.suspicionDetail ? `
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #b91c1c; line-height: 1.3; background: #fef2f2; padding: 6px; border-radius: 4px;">
            ${esc(b.suspicionDetail)}
          </p>
        ` : ''}
        ${b.noSuspicionReason ? `
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #15803d; line-height: 1.3; background: #f0fdf4; padding: 6px; border-radius: 4px;">
            <strong>סיבה לאי-אינדיקציה:</strong> ${esc(b.noSuspicionReason)}
          </p>
        ` : ''}
        ${[b.link1, b.link2, b.link3].some(l => safeUrl(l)) ? `
          <div style="margin-top: 8px; border-top: 1px solid var(--hairline); padding-top: 8px;">
            ${[b.link1, b.link2, b.link3].map((l, i) => safeUrl(l)
              ? `<div style="font-size: 11px; margin-bottom: ${i === 2 ? 0 : 6}px;"><strong>קישור ${i + 1}:</strong> <a href="${safeUrl(l)}" target="_blank" rel="noopener noreferrer" style="color: var(--hp-blue); text-decoration: none; word-break: break-all;">${esc(l)}</a></div>`
              : '').join('')}
          </div>
        ` : ''}
        ${canEdit ? `
          <div style="margin-top: 10px; border-top: 1px solid var(--hairline); padding-top: 8px;">
            <button type="button" data-fix style="width: 100%; cursor: pointer; border: 1px solid #d5dce6; background: #fff; color: var(--ink); border-radius: 6px; padding: 6px 8px; font-size: 12px; font-weight: 600;">
              תיקון מיקום
            </button>
            ${info.sameAddress > 1 ? `<p style="margin: 4px 0 0 0; font-size: 10.5px; color: var(--graphite);">יחול על ${info.sameAddress} נכסים באותה כתובת</p>` : ''}
          </div>
        ` : ''}
      </div>
`
}

interface FixState {
  key: string
  address: string
  names: string[]
  lat: number
  lon: number
  saving: boolean
  error: string
}

interface ReviewItem {
  key: string
  address: string
  names: string[]
  business: Business
  placement: Placement
}

const needsReview = (p: Placement) => p.state === 'missing' || (p.state === 'placed' && (p.kind === 'neighborhood' || p.suspiciousKm !== null))

export default function JerusalemMap({ businesses, canEdit = false, fixKey = null }: JerusalemMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  // Markers by business id, with a signature of what they show — updated in
  // place so an open popup survives live geocoding results arriving.
  const markersRef = useRef<Map<string, { marker: L.Marker; sig: string }>>(new Map())

  const [locations, setLocations] = useState<LocationMap>({})
  const [locationsLoaded, setLocationsLoaded] = useState(false)
  const queueRef = useRef<GeocodeQueue | null>(null)
  const hasFitBoundsRef = useRef(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [fix, setFix] = useState<FixState | null>(null)
  const startFixRef = useRef<(b: Business) => void>(() => {})
  const fixHandledRef = useRef(false)

  // Load the stored locations once. If the table can't be read the map still
  // works: every address is then looked up live (and saving quietly fails).
  useEffect(() => {
    try { OLD_BROWSER_CACHE_KEYS.forEach(k => localStorage.removeItem(k)) } catch {}
    let cancelled = false
    fetchLocations()
      .then(loaded => { if (!cancelled) setLocations(loaded) })
      .catch(err => console.error('Error loading address locations:', err))
      .finally(() => { if (!cancelled) setLocationsLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // Addresses with no stored location yet (e.g. an upload the employee left
  // before it finished, or an address edited later) are looked up one at a
  // time and saved, so the next viewer gets them instantly. Temporary
  // failures (rate limiting, network) are retried with backoff and never
  // recorded as "not found".
  useEffect(() => {
    const queue = createLocationQueue({
      onResult: (key, entry) => setLocations(prev => ({ ...prev, [key]: entry })),
    })
    queueRef.current = queue
    return () => { queueRef.current = null; void queue.stop() }
  }, [])

  useEffect(() => {
    if (!locationsLoaded || !queueRef.current) return
    const items: GeocodeItem[] = []
    businesses.forEach(b => {
      const key = cleanAddress(b.address)
      if (!key || key in locations) return
      items.push({ key, near: neighborhoodOf(b)?.center ?? null })
    })
    if (items.length > 0) queueRef.current.add(items)
  }, [businesses, locations, locationsLoaded])

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [MAP_CENTER.lat, MAP_CENTER.lon],
      zoom: 13,
      zoomControl: true,
    })

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const markerGroup = L.layerGroup().addTo(map)

    mapInstanceRef.current = map
    markerGroupRef.current = markerGroup
    const markers = markersRef.current

    return () => {
      markers.clear()
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Everything on one address key (a manual fix applies to all of them).
  const sameAddressCount = useMemo(() => {
    const counts = new Map<string, number>()
    businesses.forEach(b => { const k = cleanAddress(b.address); counts.set(k, (counts.get(k) ?? 0) + 1) })
    return counts
  }, [businesses])

  // Sync markers with the businesses and their placements. Only markers whose
  // position or content changed are touched — never clearLayers() — so a
  // popup the user opened stays open while live results trickle in.
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current || !locationsLoaded) return

    const markerGroup = markerGroupRef.current
    const markers = markersRef.current
    const seen = new Set<string>()
    const bounds: L.LatLngExpression[] = []

    businesses.forEach(b => {
      const placement = placementFor(b, locations)
      if (placement.state !== 'placed') return
      const { coords, kind, suspiciousKm } = placement
      seen.add(b.id)
      bounds.push([coords.lat, coords.lon])

      const color = SUSPICION_COLORS[b.suspicionRating] || DEFAULT_COLOR
      const info: PopupInfo = {
        kind, suspiciousKm,
        neighborhood: neighborhoodOf(b)?.name ?? null,
        sameAddress: sameAddressCount.get(cleanAddress(b.address)) ?? 1,
      }
      const html = popupHtml(b, info, canEdit)
      const sig = `${coords.lat},${coords.lon}|${color}|${kind}|${suspiciousKm !== null}|${html}`
      const existing = markers.get(b.id)
      if (existing?.sig === sig) return

      const popup = document.createElement('div')
      popup.innerHTML = html
      popup.querySelector('[data-fix]')?.addEventListener('click', () => startFixRef.current(b))
      const icon = createMarkerIcon(color, kind === 'neighborhood' || suspiciousKm !== null)
      if (existing) {
        existing.marker.setLatLng([coords.lat, coords.lon])
        existing.marker.setIcon(icon)
        existing.marker.setPopupContent(popup)
        existing.sig = sig
      } else {
        const marker = L.marker([coords.lat, coords.lon], { icon }).bindPopup(popup).addTo(markerGroup)
        markers.set(b.id, { marker, sig })
      }
    })

    for (const [id, { marker }] of markers) {
      if (!seen.has(id)) {
        markerGroup.removeLayer(marker)
        markers.delete(id)
      }
    }

    // Auto fit map bounds once, the first time we have markers — avoid
    // re-zooming every time a straggling live-geocoded marker trickles in
    if (bounds.length > 0 && mapInstanceRef.current && !hasFitBoundsRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(bounds), {
        padding: [50, 50],
        maxZoom: 16,
      })
      hasFitBoundsRef.current = true
    }
  }, [businesses, locations, locationsLoaded, canEdit, sameAddressCount])

  // Addresses whose location a person should look at, grouped by address.
  const review = useMemo(() => {
    const byKey = new Map<string, ReviewItem>()
    businesses.forEach(b => {
      const key = cleanAddress(b.address)
      if (!key) return
      const placement = placementFor(b, locations)
      if (!needsReview(placement)) return
      const item = byKey.get(key)
      if (item) item.names.push(b.name)
      else byKey.set(key, { key, address: b.address, names: [b.name], business: b, placement })
    })
    const items = [...byKey.values()]
    return {
      suspicious: items.filter(i => i.placement.state === 'placed' && i.placement.suspiciousKm !== null),
      neighborhood: items.filter(i => i.placement.state === 'placed' && i.placement.kind === 'neighborhood'),
      missing: items.filter(i => i.placement.state === 'missing'),
      total: items.length,
    }
  }, [businesses, locations])

  // ---- Manual location fix ----

  const startFix = useCallback((b: Business) => {
    const key = cleanAddress(b.address)
    if (!key) return
    const placement = placementFor(b, locations)
    const start = placement.state === 'placed' ? placement.coords : (neighborhoodOf(b)?.center ?? MAP_CENTER)
    setFix({
      key, address: b.address,
      names: businesses.filter(x => cleanAddress(x.address) === key).map(x => x.name),
      lat: start.lat, lon: start.lon, saving: false, error: '',
    })
    setReviewOpen(false)
  }, [businesses, locations])

  useEffect(() => { startFixRef.current = startFix }, [startFix])

  // /map?fix=<address key> opens the fix flow for that address.
  useEffect(() => {
    if (!fixKey || !canEdit || !locationsLoaded || fixHandledRef.current) return
    const b = businesses.find(x => cleanAddress(x.address) === fixKey)
    if (!b) return
    fixHandledRef.current = true
    startFix(b)
  }, [fixKey, canEdit, locationsLoaded, businesses, startFix])

  // While fixing: a draggable pin, click-to-move, Esc to cancel. Re-runs only
  // when a different address starts being fixed.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!fix || !map) return
    const marker = L.marker([fix.lat, fix.lon], { draggable: true, icon: createFixIcon(), zIndexOffset: 1000 }).addTo(map)
    const move = (ll: L.LatLng) => {
      marker.setLatLng(ll)
      setFix(f => (f ? { ...f, lat: ll.lat, lon: ll.lng, error: '' } : f))
    }
    marker.on('dragend', () => move(marker.getLatLng()))
    const onClick = (e: L.LeafletMouseEvent) => move(e.latlng)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFix(null) }
    map.on('click', onClick)
    window.addEventListener('keydown', onKey)
    map.closePopup()
    map.flyTo([fix.lat, fix.lon], Math.max(map.getZoom(), 16))
    return () => {
      map.off('click', onClick)
      window.removeEventListener('keydown', onKey)
      marker.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix?.key])

  async function saveFix() {
    if (!fix) return
    if (!isInCity(fix)) {
      setFix({ ...fix, error: `הנקודה מחוץ ל${CITY.nameHe} — גרור אותה למיקום בתוך העיר` })
      return
    }
    setFix({ ...fix, saving: true, error: '' })
    const entry = { lat: fix.lat, lon: fix.lon, precision: 'manual' as const }
    try {
      await saveLocations([{ key: fix.key, entry }])
      setLocations(prev => ({ ...prev, [fix.key]: entry }))
      setFix(null)
    } catch (e) {
      setFix(f => (f ? { ...f, saving: false, error: `השמירה נכשלה: ${e instanceof Error ? e.message : 'שגיאה'}` } : f))
    }
  }

  function focusItem(item: ReviewItem) {
    const map = mapInstanceRef.current
    if (item.placement.state === 'placed' && map) {
      map.flyTo([item.placement.coords.lat, item.placement.coords.lon], 17)
      markersRef.current.get(item.business.id)?.marker.openPopup()
    } else if (canEdit) {
      startFix(item.business)
    }
  }

  const groups: { title: string; hint: string; items: ReviewItem[] }[] = [
    { title: 'מיקום רחוק מהשכונה הרשומה', hint: 'ייתכן רחוב באותו שם בחלק אחר של העיר', items: review.suspicious },
    { title: 'מוצגים במרכז השכונה בלבד', hint: 'הרחוב לא אותר במפה', items: review.neighborhood },
    { title: 'לא מוצגים במפה', hint: 'הכתובת לא אותרה ואין שכונה רשומה', items: review.missing },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      {locationsLoaded && review.total > 0 && !fix && (
        <div dir="rtl" style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, maxWidth: 320 }}>
          <button
            type="button"
            onClick={() => setReviewOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: '100%', textAlign: 'start',
              background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e',
              borderRadius: 8, padding: '6px 10px', fontSize: 12, lineHeight: 1.5, boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            <strong>{review.total}</strong> כתובות דורשות בדיקת מיקום (מסומנות ב-!)
            <span style={{ marginInlineStart: 'auto' }}>{reviewOpen ? '▲' : '▼'}</span>
          </button>
          {reviewOpen && (
            <div style={{
              marginTop: 6, maxHeight: 340, overflowY: 'auto', background: '#fff', border: '1px solid #e2e7ee',
              borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 12,
            }}>
              {groups.filter(g => g.items.length > 0).map(g => (
                <div key={g.title} style={{ borderBottom: '1px solid #eef1f5' }}>
                  <div style={{ padding: '6px 10px 2px', fontWeight: 700, color: '#0f1a28' }}>
                    {g.title} <span style={{ color: '#7c8ba0', fontWeight: 400 }}>({g.items.length}) · {g.hint}</span>
                  </div>
                  {g.items.map(item => (
                    <div
                      key={item.key}
                      onClick={() => focusItem(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusItem(item) } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer' }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: '#0f1a28' }}>{item.address}</span>
                        <span style={{ color: '#5b6a7d' }}> · {item.names.slice(0, 2).join(', ')}{item.names.length > 2 ? ` ועוד ${item.names.length - 2}` : ''}</span>
                        {item.placement.state === 'placed' && item.placement.suspiciousKm !== null && (
                          <span style={{ color: '#5b6a7d' }}> · {item.placement.suspiciousKm.toFixed(1)} ק״מ מהשכונה</span>
                        )}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); startFix(item.business) }}
                          style={{ flexShrink: 0, cursor: 'pointer', border: '1px solid #d5dce6', background: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 600, color: '#024ad8' }}
                        >
                          קביעת מיקום
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {fix && (
        <div
          dir="rtl"
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
            width: 'min(92%, 460px)', background: '#fff', border: '1px solid #b9cdf7', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(2,74,216,0.2)', padding: '12px 14px', fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, color: '#0f1a28' }}>קביעת מיקום: {fix.address}</div>
          <div style={{ color: '#5b6a7d', fontSize: 12, marginTop: 2 }}>
            {fix.names.slice(0, 3).join(', ')}{fix.names.length > 3 ? ` ועוד ${fix.names.length - 3}` : ''}
            {fix.names.length > 1 && ` — המיקום יחול על כל ${fix.names.length} הנכסים בכתובת`}
          </div>
          <div style={{ color: '#3f4b5c', fontSize: 12, marginTop: 6 }}>גרור את הסימון הכחול למיקום הנכון, או לחץ על המפה. Esc לביטול.</div>
          {fix.error && <div style={{ color: '#c8102e', fontSize: 12, marginTop: 6, fontWeight: 600 }}>{fix.error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button" onClick={saveFix} disabled={fix.saving}
              style={{ cursor: fix.saving ? 'default' : 'pointer', background: '#024ad8', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 13, opacity: fix.saving ? 0.6 : 1 }}
            >
              {fix.saving ? 'שומר…' : 'שמור מיקום'}
            </button>
            <button
              type="button" onClick={() => setFix(null)} disabled={fix.saving}
              style={{ cursor: 'pointer', background: '#fff', color: '#3f4b5c', border: '1px solid #d5dce6', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 13 }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          minHeight: '500px', 
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid var(--hairline)',
          zIndex: 1
        }} 
      />
      {!locationsLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
          borderRadius: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              border: '3px solid var(--fog)', 
              borderTopColor: 'var(--hp-blue)', 
              borderRadius: '50%', 
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px'
            }} />
            <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>טוען נתוני מפה...</p>
          </div>
        </div>
      )}
    </div>
  )
}
