import { supabase } from './supabase'
import {
  MISSING_RETRY_MS, isInJerusalem, nominatimSearchUrl, RateLimitError,
  type LocationEntry, type LocationMap, type NominatimResult, type Precision,
} from './geocode'
import { createGeocodeQueue, type GeocodeQueueOptions } from './geocodeQueue'
import { fetchAllRows } from './fetchAll'

// Property locations live in the Supabase table address_locations — one row
// per cleaned address (see cleanAddress), shared by every user. Addresses are
// located once, right after an upload (see the upload page); the map fills in
// any that are still missing.

interface LocationRow extends Record<string, unknown> {
  address_key: string
  lat: number | null
  lon: number | null
  precision: Precision | 'neighborhood' | null
  /** Placed by hand on the map; such a row is never overwritten by an automatic lookup (database trigger). */
  manual: boolean
  status: 'placed' | 'not_found'
  updated_at: string
}

/**
 * All stored locations (read in pages — see fetchAll). Left out, so that the
 * address is looked up again: "not found" rows older than MISSING_RETRY_MS,
 * and old rows that stored a neighborhood-level pin (those are derived from
 * the record's current neighborhood now, see placement.ts).
 * Throws if the table can't be read.
 */
export async function fetchLocations(): Promise<LocationMap> {
  const rows = await fetchAllRows<LocationRow>('address_locations', {
    select: 'address_key, lat, lon, precision, manual, status, updated_at',
    orderBy: 'address_key',
  })
  const map: LocationMap = {}
  const now = Date.now()
  for (const row of rows) {
    if (row.status === 'placed' && row.lat !== null && row.lon !== null && row.precision && row.precision !== 'neighborhood') {
      if (isInJerusalem({ lat: row.lat, lon: row.lon })) {
        map[row.address_key] = { lat: row.lat, lon: row.lon, precision: row.manual ? 'manual' : row.precision }
      }
    } else if (row.status === 'not_found') {
      const missingAt = Date.parse(row.updated_at)
      if (now - missingAt <= MISSING_RETRY_MS) map[row.address_key] = { missingAt }
    }
  }
  return map
}

/** Upserts finished lookups. Throws on failure. */
export async function saveLocations(rows: { key: string; entry: LocationEntry }[]): Promise<void> {
  if (rows.length === 0) return
  const updated_at = new Date().toISOString()
  // A hand-placed location is stored as an exact one with manual = true.
  const payload = rows.map(({ key, entry }) =>
    'missingAt' in entry
      ? { address_key: key, lat: null, lon: null, precision: null, manual: false, status: 'not_found', updated_at }
      : {
          address_key: key, lat: entry.lat, lon: entry.lon,
          precision: entry.precision === 'manual' ? 'exact' : entry.precision,
          manual: entry.precision === 'manual', status: 'placed', updated_at,
        },
  )
  const { error } = await supabase.from('address_locations').upsert(payload, { onConflict: 'address_key' })
  if (error) throw new Error(error.message)
}

export async function nominatimSearch(query: string): Promise<NominatimResult[]> {
  const res = await fetch(nominatimSearchUrl(query), { headers: { 'Accept-Language': 'he,en;q=0.9' } })
  if (res.status === 429) throw new RateLimitError('429')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** A geocoding queue wired to Nominatim and the address_locations table. */
export function createLocationQueue(opts: Omit<GeocodeQueueOptions, 'search' | 'save'> = {}) {
  return createGeocodeQueue({ ...opts, search: nominatimSearch, save: saveLocations })
}
