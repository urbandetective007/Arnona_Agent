import { supabase } from './supabase'
import {
  MISSING_RETRY_MS, isInJerusalem, nominatimSearchUrl, RateLimitError,
  type LocationEntry, type LocationMap, type NominatimResult, type Precision,
} from './geocode'
import { createGeocodeQueue, type GeocodeQueueOptions } from './geocodeQueue'

// Property locations live in the Supabase table address_locations — one row
// per cleaned address (see cleanAddress), shared by every user. Addresses are
// located once, right after an upload (see the upload page); the map fills in
// any that are still missing.

const PAGE_SIZE = 1000 // Supabase returns at most 1000 rows per request

interface LocationRow {
  address_key: string
  lat: number | null
  lon: number | null
  precision: Precision | null
  status: 'placed' | 'not_found'
  updated_at: string
}

/**
 * All stored locations. "Not found" rows older than MISSING_RETRY_MS are left
 * out, so those addresses get looked up again. Throws if the table can't be read.
 */
export async function fetchLocations(): Promise<LocationMap> {
  const map: LocationMap = {}
  const now = Date.now()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('address_locations')
      .select('address_key, lat, lon, precision, status, updated_at')
      .order('address_key')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as LocationRow[]) {
      if (row.status === 'placed' && row.lat !== null && row.lon !== null && row.precision) {
        if (isInJerusalem({ lat: row.lat, lon: row.lon })) {
          map[row.address_key] = { lat: row.lat, lon: row.lon, precision: row.precision }
        }
      } else if (row.status === 'not_found') {
        const missingAt = Date.parse(row.updated_at)
        if (now - missingAt <= MISSING_RETRY_MS) map[row.address_key] = { missingAt }
      }
    }
    if (!data || data.length < PAGE_SIZE) return map
  }
}

/** Upserts finished lookups. Throws on failure. */
export async function saveLocations(rows: { key: string; entry: LocationEntry }[]): Promise<void> {
  if (rows.length === 0) return
  const updated_at = new Date().toISOString()
  const payload = rows.map(({ key, entry }) =>
    'missingAt' in entry
      ? { address_key: key, lat: null, lon: null, precision: null, status: 'not_found', updated_at }
      : { address_key: key, lat: entry.lat, lon: entry.lon, precision: entry.precision, status: 'placed', updated_at },
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
