// Address → coordinates for the property map. Shared by the map component,
// the upload page (which locates new addresses right after an upload) and
// scripts/geocode-addresses.mjs, so all of them place addresses the same
// way. Deliberately import-free so plain Node can load it.
//
// Every property is in Jerusalem, so a result anywhere else is a lookup
// error, never a real location: searches are bounded to Jerusalem and a
// result is only accepted if OpenStreetMap itself says its city is
// Jerusalem (the bounding box alone also covers Mevaseret Zion, Beit Jala,
// Givat Zeev…).

/**
 * How precisely a stored location was found: `exact` = the building,
 * `street` = the street (the house number isn't mapped), `manual` = placed by
 * hand on the map. A location at the center of the property's neighborhood is
 * never stored — it is derived from the property's current neighborhood when
 * shown (see placement.ts) — so it isn't a Precision.
 */
export type Precision = 'exact' | 'street' | 'manual'

export interface Coords {
  lat: number
  lon: number
  /** Missing on older static-cache entries, which are house-level. */
  precision?: Precision
}

/** A stored location: placed with a precision, or looked up and not found. */
export type LocationEntry = (Coords & { precision: Precision }) | { missingAt: number }
/** Locations by address key (see cleanAddress). */
export type LocationMap = Record<string, LocationEntry>

export function isMissingEntry(e: LocationEntry): e is { missingAt: number } {
  return 'missingAt' in e
}

/** An address not found is looked up again after this long. */
export const MISSING_RETRY_MS = 7 * 24 * 60 * 60 * 1000

export const JERUSALEM_BOUNDS = { south: 31.70, north: 31.90, west: 35.07, east: 35.32 }

/** Straight-line distance in km (accurate enough at city scale). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (a.lat - b.lat) * 111.32
  const dLon = (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLon)
}

export function isInJerusalem(c: { lat: number; lon: number }): boolean {
  return c.lat >= JERUSALEM_BOUNDS.south && c.lat <= JERUSALEM_BOUNDS.north &&
    c.lon >= JERUSALEM_BOUNDS.west && c.lon <= JERUSALEM_BOUNDS.east
}

const PREFIXES = ['רחוב ', "רח' ", 'שדרות ', "שד' ", 'שד ', 'סמטת ', 'כיכר ', 'גן ', 'מעלה ', 'מורד ']

/** Cache key for an address: street + number, without city, prefixes or apartment. */
export function cleanAddress(address: string): string {
  if (!address) return ''
  let base = address.split(',')[0].trim()
  for (const prefix of PREFIXES) {
    if (base.startsWith(prefix)) { base = base.slice(prefix.length); break }
  }
  base = base.replace(/\s+/g, ' ').trim()
  return base.replace(/\s+(דירה|דיר|דר|יח'|יחידה|קומה)\s+\d+.*/i, '').trim()
}

interface ParsedAddress { street: string; number: string | null }

// "דיסקין 9א" → דיסקין / 9 · "נובומיסקי משה 1/2" → נובומיסקי משה / 1 ·
// "בית הדפוס 12 גבעת שאול" → בית הדפוס / 12 · "דיר אבו טור 0" → no number.
function parseAddress(clean: string): ParsedAddress {
  const m = clean.match(/^(.*?\D)\s*(\d+)(?:\s*[א-ת]|\s*\/\s*[\dא-ת]+)?(?:\s+.*)?$/)
  if (!m) return { street: clean.trim(), number: null }
  const street = m[1].trim()
  const number = m[2] === '0' ? null : m[2]
  return { street, number }
}

// Street-name spellings worth trying, most likely first.
function streetVariants(street: string): string[] {
  const out = [street]
  if (street.startsWith('הרב ')) out.push(street.slice(4))
  if (street.includes('"')) out.push(street.replace(/"/g, '״'), street.replace(/"/g, ''))
  // Municipal records often put the surname first ("אלקחי מרדכי"); OSM uses
  // the given name first. Only for plain two-word names.
  const words = street.split(' ')
  const NOT_PERSON = ['בית', 'גבעת', 'דרך', 'עין', 'הר', 'שדה', 'נוף', 'רמת', 'קרית', 'כפר', 'נווה', 'מבוא']
  if (words.length === 2 && !words[0].startsWith('ה') && !NOT_PERSON.includes(words[0])) {
    out.push(`${words[1]} ${words[0]}`)
  }
  return [...new Set(out)]
}

/** Address queries (street + number) to try in order — exported for testing. */
export function addressVariants(clean: string): string[] {
  const { street, number } = parseAddress(clean)
  if (!number) return []
  return [...new Set([clean, ...streetVariants(street).map(s => `${s} ${number}`)])]
}

export interface NominatimResult {
  lat: string
  lon: string
  address?: Record<string, string>
}

export class RateLimitError extends Error {}

/** Nominatim search URL for one query, bounded to Jerusalem. */
export function nominatimSearchUrl(query: string): string {
  const { west, north, east, south } = JERUSALEM_BOUNDS
  const params = new URLSearchParams({
    format: 'json',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'il',
    viewbox: `${west},${north},${east},${south}`,
    bounded: '1',
    q: `${query}, ירושלים`,
  })
  return `https://nominatim.openstreetmap.org/search?${params}`
}

function isJerusalemResult(r: NominatimResult): boolean {
  const a = r.address ?? {}
  const city = [a.city, a.town, a.municipality, a.village].find(Boolean) ?? ''
  if (!/ירושלים|jerusalem/i.test(city)) return false
  return isInJerusalem({ lat: parseFloat(r.lat), lon: parseFloat(r.lon) })
}

export interface GeocodeOptions {
  /** Runs one Nominatim query (see nominatimSearchUrl). Throws RateLimitError on 429, any Error on other failures. */
  search: (query: string) => Promise<NominatimResult[]>
  /** Pause between consecutive queries (Nominatim allows ~1/sec). */
  delayMs: number
}

// Neighborhood spellings OSM uses: "וואדי אל-ג'וז" → "ואדי אל-ג'וז",
// "אזור תעשייה עטרות" → "עטרות".
export function areaVariants(area: string): string[] {
  const out = [area]
  if (/(^|\s)וו/.test(area)) out.push(area.replace(/(^|\s)וו/g, '$1ו'))
  if (area.startsWith('אזור תעשייה ')) out.push(area.slice('אזור תעשייה '.length))
  return [...new Set(out)]
}

/**
 * Area named in the address itself ("גרמי ציון 15, פסגת זאב, ירושלים" →
 * פסגת זאב), used when the record has no neighborhood of its own.
 */
export function neighborhoodHint(address: string, neighborhood: string | null | undefined): string | null {
  if (neighborhood?.trim()) return neighborhood.trim()
  const parts = address.split(',').slice(1).map(p => p.trim())
    .filter(p => p && !/^ירושלים(\s+\d+)?$/.test(p) && !/^\d+$/.test(p))
  return parts[0] ?? null
}

function toCoords(r: NominatimResult) {
  return { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }
}

/** Center of a named area (a neighborhood) inside Jerusalem, or null. */
export async function geocodeArea(area: string, opts: GeocodeOptions): Promise<{ lat: number; lon: number } | null> {
  let first = true
  for (const q of areaVariants(area)) {
    if (!first) await new Promise(r => setTimeout(r, opts.delayMs))
    first = false
    const r = (await opts.search(q)).find(isJerusalemResult)
    if (r) return toCoords(r)
  }
  return null
}

/**
 * Places an address inside Jerusalem (house → street), or returns null if
 * nothing in Jerusalem matches. Throws (RateLimitError / Error) on temporary
 * failures — callers must retry later rather than record those as "not found".
 *
 * Many street names exist in several parts of the city. When `near` (the
 * center of the property's neighborhood) is given and a search returns
 * several Jerusalem matches, the one closest to it is used, instead of
 * whichever OpenStreetMap lists first.
 */
export async function geocodeAddress(clean: string, opts: GeocodeOptions, near?: { lat: number; lon: number } | null): Promise<Coords | null> {
  let first = true
  const run = async (query: string) => {
    if (!first) await new Promise(r => setTimeout(r, opts.delayMs))
    first = false
    const matches = (await opts.search(query)).filter(isJerusalemResult)
    if (matches.length <= 1 || !near) return matches[0] ?? null
    return matches.reduce((best, m) => (distanceKm(toCoords(m), near) < distanceKm(toCoords(best), near) ? m : best))
  }

  // 1. House-level. A hit without a house number is only street-level, so
  //    keep trying the other spellings for an exact one before settling.
  let streetHit: Coords | null = null
  for (const q of addressVariants(clean)) {
    const r = await run(q)
    if (!r) continue
    if (r.address?.house_number) return { ...toCoords(r), precision: 'exact' }
    streetHit ??= { ...toCoords(r), precision: 'street' }
  }
  if (streetHit) return streetHit

  // 2. Street-level (no number in the address, or the number wasn't found).
  for (const s of streetVariants(parseAddress(clean).street)) {
    const r = await run(s)
    if (r) return { ...toCoords(r), precision: 'street' }
  }

  return null
}
