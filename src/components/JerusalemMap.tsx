'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Business } from '@/lib/types'
import { normalizeAddress } from '@/lib/addressUtils'

interface JerusalemMapProps {
  businesses: Business[]
}

// Clean address key to match geocoded_addresses.json
function getCleanAddress(address: string): string {
  if (!address) return ''
  const base = address.split(',')[0].trim()
  const norm = normalizeAddress(base)
  return norm.replace(/\s+(דירה|דיר|דר|יח'|יחידה|קומה)\s+\d+.*/i, '').trim()
}

// Fallback for addresses missing from the static geocoded_addresses.json cache —
// geocode live via Nominatim and remember the result in this browser, so the
// map never silently drops a business just because the static cache is stale.
const LIVE_GEOCODE_CACHE_KEY = 'arnona_live_geocode_cache_v1'
const NOMINATIM_DELAY_MS = 1100 // respect Nominatim's ~1 req/sec usage policy

type Coords = { lat: number; lon: number }

function loadLiveGeocodeCache(): Record<string, Coords | null> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LIVE_GEOCODE_CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLiveGeocodeCache(cache: Record<string, Coords | null>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LIVE_GEOCODE_CACHE_KEY, JSON.stringify(cache)) } catch {}
}

async function geocodeLive(cleanAddress: string): Promise<Coords | null> {
  const query = cleanAddress.includes('ירושלים') ? cleanAddress : `${cleanAddress}, ירושלים`
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'Accept-Language': 'he,en;q=0.9' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    }
    return null
  } catch {
    return null
  }
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
const createMarkerIcon = (color: string) => {
  return L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/>
      </svg>
    `,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

export default function JerusalemMap({ businesses }: JerusalemMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  
  const [coordsCache, setCoordsCache] = useState<Record<string, { lat: number; lon: number } | null>>({})
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const [liveCache, setLiveCache] = useState<Record<string, Coords | null>>({})
  const geocodingQueueRef = useRef<Set<string>>(new Set())
  const hasFitBoundsRef = useRef(false)

  // Load any previously live-geocoded addresses remembered in this browser
  useEffect(() => {
    setLiveCache(loadLiveGeocodeCache())
  }, [])

  // Fallback: geocode any address missing from BOTH the static cache and the
  // live cache, one at a time (Nominatim rate limit), so no business is ever
  // silently dropped just because the static geocoded_addresses.json is stale.
  useEffect(() => {
    if (!cacheLoaded) return

    const toQueue: string[] = []
    businesses.forEach(b => {
      const cleanAddr = getCleanAddress(b.address)
      if (!cleanAddr) return
      if (cleanAddr in coordsCache) return
      if (cleanAddr in liveCache) return
      if (geocodingQueueRef.current.has(cleanAddr)) return
      toQueue.push(cleanAddr)
    })
    if (toQueue.length === 0) return
    toQueue.forEach(a => geocodingQueueRef.current.add(a))

    let cancelled = false
    ;(async () => {
      for (const addr of toQueue) {
        if (cancelled) break
        const result = await geocodeLive(addr)
        if (cancelled) break
        setLiveCache(prev => {
          const next = { ...prev, [addr]: result }
          saveLiveGeocodeCache(next)
          return next
        })
        await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS))
      }
    })()

    return () => { cancelled = true }
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

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update Markers when businesses change or cache loads
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current || !cacheLoaded) return

    const markerGroup = markerGroupRef.current
    markerGroup.clearLayers()

    const bounds: L.LatLngExpression[] = []

    businesses.forEach(b => {
      const cleanAddr = getCleanAddress(b.address)
      const coords = coordsCache[cleanAddr] ?? liveCache[cleanAddr]

      if (coords && coords.lat && coords.lon) {
        const color = SUSPICION_COLORS[b.suspicionRating] || DEFAULT_COLOR
        const icon = createMarkerIcon(color)

        const popupContent = `
          <div style="font-family: var(--font-manrope), sans-serif; text-align: right; direction: rtl; min-width: 200px;">
            <h3 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: var(--ink);">${b.name}</h3>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
              <strong>סוג עסק:</strong> ${b.type || 'לא ידוע'}
            </p>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: var(--charcoal);">
              <strong>כתובת:</strong> ${b.address}
            </p>
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

        const marker = L.marker([coords.lat, coords.lon], { icon })
          .bindPopup(popupContent)
          .addTo(markerGroup)

        bounds.push([coords.lat, coords.lon])
      }
    })

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
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
