import centers from '../../data/jerusalem_neighborhood_centers.json'
import { normalizeNeighborhood } from './neighborhoods'
import {
  cleanAddress, distanceKm, isInJerusalem, isMissingEntry, neighborhoodHint,
  type LocationMap, type Precision,
} from './geocode'

// Where a business is drawn on the map, from its stored location and its
// *current* neighborhood. Locations at the center of a neighborhood are never
// stored — they are derived here — so correcting a record's neighborhood
// moves its pin at once.

const NEIGHBORHOOD_CENTERS: Record<string, { lat: number; lon: number }> = centers

/** A pin farther than this from the center of its record's neighborhood is flagged for review. */
export const SUSPICIOUS_DISTANCE_KM = 2.5

type Pt = { lat: number; lon: number }

/** The neighborhood of a record (its own field, else one named in the address) and its center. */
export function neighborhoodOf(b: { address: string; neighborhood: string }): { name: string; center: Pt } | null {
  const hint = neighborhoodHint(b.address, b.neighborhood)
  const name = hint ? normalizeNeighborhood(hint) : null
  const center = name ? NEIGHBORHOOD_CENTERS[name] : undefined
  return name && center ? { name, center } : null
}

export type PlacementKind = Precision | 'neighborhood'

export type Placement =
  /** Drawn on the map. `suspiciousKm` is set when the pin is far from the record's neighborhood. */
  | { state: 'placed'; coords: Pt; kind: PlacementKind; suspiciousKm: number | null }
  /** The street wasn't found and the record has no usable neighborhood — nothing to draw. */
  | { state: 'missing' }
  /** Not looked up yet. */
  | { state: 'pending' }

export function placementFor(b: { address: string; neighborhood: string }, locations: LocationMap): Placement {
  const key = cleanAddress(b.address)
  const entry = key ? locations[key] : undefined
  const hood = neighborhoodOf(b)

  if (!entry) return key ? { state: 'pending' } : fallbackToNeighborhood(hood)
  if (isMissingEntry(entry) || !isInJerusalem(entry)) return fallbackToNeighborhood(hood)

  // A pin placed by hand has been checked by a person, so it is never flagged.
  const far = entry.precision !== 'manual' && hood ? distanceKm(entry, hood.center) : 0
  return {
    state: 'placed',
    coords: { lat: entry.lat, lon: entry.lon },
    kind: entry.precision,
    suspiciousKm: far > SUSPICIOUS_DISTANCE_KM ? far : null,
  }
}

function fallbackToNeighborhood(hood: ReturnType<typeof neighborhoodOf>): Placement {
  return hood
    ? { state: 'placed', coords: hood.center, kind: 'neighborhood', suspiciousKm: null }
    : { state: 'missing' }
}
