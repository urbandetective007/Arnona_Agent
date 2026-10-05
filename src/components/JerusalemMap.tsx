'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Business } from '@/lib/types'
import {
  cleanAddress, neighborhoodHint, geocodeAddress, nominatimSearchUrl, isInJerusalem, RateLimitError,
  type Coords, type NominatimResult, type Precision,
} from '@/lib/geocode'

interface JerusalemMapProps {
  businesses: Business[]
}

// Fallback for addresses missing from the static geocoded_addresses.json cache
// (refreshed by scripts/geocode-addresses.mjs): geocode live via Nominatim and
// remember the result in this browser. v2 drops everything the old lookup
// stored — including addresses wrongly recorded as "not found" when
// Nominatim was merely rate-limiting us, and results outside Jerusalem.
const LIVE_GEOCODE_CACHE_KEY = 'arnona_live_geocode_cache_v2'
const OLD_LIVE_GEOCODE_CACHE_KEYS = ['arnona_live_geocode_cache_v1']
const NOMINATIM_DELAY_MS = 1100 // respect Nominatim's ~1 req/sec usage policy
const MISSING_RETRY_MS = 7 * 24 * 60 * 60 * 1000 // re-try "not found" addresses weekly
const BACKOFF_START_MS = 30_000
const BACKOFF_MAX_MS = 5 * 60_000

type LiveEntry = Coords | { missingAt: number }

function loadLiveGeocodeCache(): Record<string, LiveEntry> {
  if (typeof window === 'undefined') return {}
  try {
    OLD_LIVE_GEOCODE_CACHE_KEYS.forEach(k => localStorage.removeItem(k))
    const raw = localStorage.getItem(LIVE_GEOCODE_CACHE_KEY)
    const cache: Record<string, LiveEntry> = raw ? JSON.parse(raw) : {}
    const now = Date.now()
    for (const [addr, entry] of Object.entries(cache)) {
      if ('missingAt' in entry ? now - entry.missingAt > MISSING_RETRY_MS : !isInJerusalem(entry)) {
        delete cache[addr]
      }
    }
    return cache
  } catch {
    return {}
  }
}

function saveLiveGeocodeCache(cache: Record<string, LiveEntry>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LIVE_GEOCODE_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const res = await fetch(nominatimSearchUrl(query), { headers: { 'Accept-Language': 'he,en;q=0.9' } })
  if (res.status === 429) throw new RateLimitError('429')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

type Placement =
  | { state: 'placed'; coords: Coords; precision: Precision }
  | { state: 'missing' }
  | { state: 'pending' }

// Where to draw a business. Anything outside Jerusalem is ignored — every
// property is in Jerusalem, so such a coordinate can only be a lookup error.
function placementFor(
  key: string,
  staticCache: Record<string, Coords | null>,
  liveCache: Record<string, LiveEntry>,
): Placement {
  const fromStatic = staticCache[key]
  if (fromStatic && isInJerusalem(fromStatic)) {
    return { state: 'placed', coords: fromStatic, precision: fromStatic.precision ?? 'exact' }
  }
  const live = liveCache[key]
  if (live && !('missingAt' in live) && isInJerusalem(live)) {
    return { state: 'placed', coords: live, precision: live.precision ?? 'exact' }
  }
  if (live && 'missingAt' in live) return { state: 'missing' }
  return { state: 'pending' }
}

// Suspicion colors mapping
const SUSPICION_COLORS: Record<string, string> = {
  'גבוה': '#ef4444',      // Red
  'בינוני': '#f97316',     // Orange
  'דרוש בדיקה': '#3b82f6', // Blue
  'לא חשוד': '#22c55e',    // Green
}

const DEFAULT_COLOR = '#9ca3af' // Gray

// SVG marker creator function
// `uncertain` adds an amber "!" badge — the address itself wasn't found, so
// the pin marks the property's neighborhood rather than its building.
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

function popupHtml(b: Business, precision: Precision): string {
  return `
      <div style="font-family: var(--font-manrope), sans-serif; text-align: right; direction: rtl; min-width: 200px;">
        <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: var(--ink);">${b.name}</h3>
        ${precision === 'neighborhood' ? `
        <p style="margin: 0 0 8px 0; font-size: 11px; color: #92400e; line-height: 1.35; background: #fffbeb; border: 1px solid #fcd34d; padding: 6px; border-radius: 4px;">
          <strong>מיקום משוער:</strong> הכתובת לא אותרה במפה, והנקודה מוצגת במרכז השכונה. כדאי לבדוק את הכתובת.
        </p>
        ` : ''}
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>סוג עסק:</strong> ${b.type || 'לא ידוע'}
        </p>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>כתובת:</strong> ${b.address}
        </p>
        ${precision === 'street' ? `
        <p style="margin: 0 0 4px 0; font-size: 11px; color: var(--graphite);">מיקום לפי הרחוב (מספר הבית לא אותר במפה)</p>
        ` : ''}
        ${b.neighborhood ? `
        <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
          <strong>שכונה:</strong> ${b.neighborhood}
        </p>
        ` : ''}
        <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--charcoal);">
          <strong>כתובת עירייה:</strong> ${b.matchedAddress || 'לא נמצאה'}
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
            ${b.suspicionRating}
          </span>
        </div>
        ${b.suspicionDetail ? `
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #b91c1c; line-height: 1.3; background: #fef2f2; padding: 6px; border-radius: 4px;">
            ${b.suspicionDetail}
          </p>
        ` : ''}
        ${b.noSuspicionReason ? `
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #15803d; line-height: 1.3; background: #f0fdf4; padding: 6px; border-radius: 4px;">
            <strong>סיבה לאי-אינדיקציה:</strong> ${b.noSuspicionReason}
          </p>
        ` : ''}
        ${[b.link1, b.link2, b.link3].filter(Boolean).length > 0 ? `
          <div style="margin-top: 8px; border-top: 1px solid var(--hairline); padding-top: 8px;">
            ${b.link1 ? `<div style="font-size: 11px; margin-bottom: 6px;"><strong>קישור 1:</strong> <a href="${b.link1}" target="_blank" rel="noopener noreferrer" style="color: var(--hp-blue); text-decoration: none; word-break: break-all;">${b.link1}</a></div>` : ''}
            ${b.link2 ? `<div style="font-size: 11px; margin-bottom: 6px;"><strong>קישור 2:</strong> <a href="${b.link2}" target="_blank" rel="noopener noreferrer" style="color: var(--hp-blue); text-decoration: none; word-break: break-all;">${b.link2}</a></div>` : ''}
            ${b.link3 ? `<div style="font-size: 11px; margin-bottom: 0;"><strong>קישור 3:</strong> <a href="${b.link3}" target="_blank" rel="noopener noreferrer" style="color: var(--hp-blue); text-decoration: none; word-break: break-all;">${b.link3}</a></div>` : ''}
          </div>
        ` : ''}
      </div>
`
}

export default function JerusalemMap({ businesses }: JerusalemMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  // Markers by business id, with a signature of what they show — updated in
  // place so an open popup survives live geocoding results arriving.
  const markersRef = useRef<Map<string, { marker: L.Marker; sig: string }>>(new Map())

  const [coordsCache, setCoordsCache] = useState<Record<string, Coords | null>>({})
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const [liveCache, setLiveCache] = useState<Record<string, LiveEntry>>({})
  const geocodingQueueRef = useRef<Set<string>>(new Set())
  const hasFitBoundsRef = useRef(false)

  // Load any previously live-geocoded addresses remembered in this browser
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
    setLiveCache(loadLiveGeocodeCache())
  }, [])

  // Live geocoding for addresses the static cache doesn't place. A single
  // long-lived worker drains the queue one address at a time. Temporary
  // failures (rate limiting, network) are never recorded as "not found":
  // the address goes back on the queue and the worker pauses with backoff.
  const pendingRef = useRef<{ key: string; area: string | null }[]>([])
  const workerRunningRef = useRef(false)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false
    return () => { unmountedRef.current = true }
  }, [])

  useEffect(() => {
    if (!cacheLoaded) return

    businesses.forEach(b => {
      const key = cleanAddress(b.address)
      if (!key) return
      if (placementFor(key, coordsCache, liveCache).state !== 'pending') return
      if (geocodingQueueRef.current.has(key)) return
      geocodingQueueRef.current.add(key)
      pendingRef.current.push({ key, area: neighborhoodHint(b.address, b.neighborhood) })
    })
    if (workerRunningRef.current || pendingRef.current.length === 0) return

    workerRunningRef.current = true
    ;(async () => {
      let backoff = BACKOFF_START_MS
      while (pendingRef.current.length > 0 && !unmountedRef.current) {
        const item = pendingRef.current.shift()!
        let entry: LiveEntry
        try {
          const result = await geocodeAddress(item.key, item.area, { search: nominatimSearch, delayMs: NOMINATIM_DELAY_MS })
          entry = result ?? { missingAt: Date.now() }
          backoff = BACKOFF_START_MS
        } catch {
          pendingRef.current.push(item)
          await new Promise(r => setTimeout(r, backoff))
          backoff = Math.min(backoff * 2, BACKOFF_MAX_MS)
          continue
        }
        if (unmountedRef.current) break
        setLiveCache(prev => {
          const next = { ...prev, [item.key]: entry }
          saveLiveGeocodeCache(next)
          return next
        })
        await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS))
      }
      workerRunningRef.current = false
    })()
  }, [businesses, coordsCache, liveCache, cacheLoaded])

  // Load coordinates cache once on mount
  useEffect(() => {
    fetch('/Arnona_Agent/geocoded_addresses.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load geocoding cache')
        return res.json()
      })
      .then(data => {
        setCoordsCache(data)
        setCacheLoaded(true)
      })
      .catch(err => {
        console.error('Error fetching geocoded addresses:', err)
        setCacheLoaded(true) // Set loaded even on error to run map initialization
      })
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Center of Jerusalem
    const defaultCenter: L.LatLngExpression = [31.7683, 35.2137]
    const map = L.map(mapRef.current, {
      center: defaultCenter,
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

  // Sync markers with the businesses and their placements. Only markers whose
  // position or content changed are touched — never clearLayers() — so a
  // popup the user opened stays open while live results trickle in.
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current || !cacheLoaded) return

    const markerGroup = markerGroupRef.current
    const markers = markersRef.current
    const seen = new Set<string>()
    const bounds: L.LatLngExpression[] = []

    businesses.forEach(b => {
      const placement = placementFor(cleanAddress(b.address), coordsCache, liveCache)
      if (placement.state !== 'placed') return
      const { coords, precision } = placement
      seen.add(b.id)
      bounds.push([coords.lat, coords.lon])

      const color = SUSPICION_COLORS[b.suspicionRating] || DEFAULT_COLOR
      const html = popupHtml(b, precision)
      const sig = `${coords.lat},${coords.lon}|${color}|${precision}|${html}`
      const existing = markers.get(b.id)
      if (existing?.sig === sig) return

      const icon = createMarkerIcon(color, precision === 'neighborhood')
      if (existing) {
        existing.marker.setLatLng([coords.lat, coords.lon])
        existing.marker.setIcon(icon)
        existing.marker.setPopupContent(html)
        existing.sig = sig
      } else {
        const marker = L.marker([coords.lat, coords.lon], { icon }).bindPopup(html).addTo(markerGroup)
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
  }, [businesses, coordsCache, liveCache, cacheLoaded])

  // Surface location problems instead of hiding them: pins shown only at
  // neighborhood level, and properties that couldn't be placed at all.
  // Addresses still being looked up (or waiting out rate limiting) don't count.
  const locationIssues = useMemo(() => {
    let uncertain = 0
    let notFound = 0
    businesses.forEach(b => {
      const key = cleanAddress(b.address)
      if (!key) { notFound++; return }
      const placement = placementFor(key, coordsCache, liveCache)
      if (placement.state === 'missing') notFound++
      else if (placement.state === 'placed' && placement.precision === 'neighborhood') uncertain++
    })
    return { uncertain, notFound }
  }, [businesses, coordsCache, liveCache])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      {cacheLoaded && (locationIssues.uncertain > 0 || locationIssues.notFound > 0) && (
        <div
          dir="rtl"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e',
            borderRadius: 8, padding: '6px 10px', fontSize: 12, lineHeight: 1.5,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)', maxWidth: 260,
          }}
        >
          {locationIssues.uncertain > 0 && (
            <div><strong>{locationIssues.uncertain}</strong> נכסים מוצגים במרכז השכונה בלבד (מסומנים ב-!)</div>
          )}
          {locationIssues.notFound > 0 && (
            <div><strong>{locationIssues.notFound}</strong> נכסים שלא אותרו ואינם מוצגים במפה</div>
          )}
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
      {!cacheLoaded && (
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
