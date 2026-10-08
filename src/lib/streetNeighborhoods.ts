'use client'

import { useEffect, useState } from 'react'
import { cleanAddress, parseAddress } from './geocode'

// Street → neighborhood table, built by tools/neighborhoods/build_street_index.py
// from the agent's address list and the municipality's street list. Loaded with
// a dynamic import, so it's a separate chunk fetched only by pages that need it
// (manual entry) and doesn't weigh on the rest of the site.

export interface StreetTable {
  streets: Record<string, string[]>
  houses: Record<string, Record<string, string>>
}

const PREFIXES = ['שכ ', 'שכונת ', 'דרך ', 'רחוב ', 'שדרות ', 'שד ', 'הרבנית ', 'הרב ', 'האדמור ', 'רבי ', 'ר ']

// Same key as street_key() in build_street_index.py: no quotes or hyphens, no
// alley suffix ("סמ3"), no title/street-type prefix, words sorted — so
// "הרב שמעון אגסי" and "אגסי שמעון" meet.
export function streetKey(street: string): string {
  let s = street.replace(/["'`׳״’]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  s = s.replace(/\s+סמ\s*\d+$/, '').trim()
  for (const p of PREFIXES) {
    if (s.startsWith(p)) s = s.slice(p.length)
  }
  return s.split(' ').filter(Boolean).sort().join(' ')
}

export interface NeighborhoodMatch {
  /** Candidate neighborhoods, most likely first. Empty when the street isn't known. */
  options: string[]
  /** True when a known house number pinned it to one neighborhood. */
  byHouse: boolean
}

const NO_MATCH: NeighborhoodMatch = { options: [], byHouse: false }

// The street's key, or — when the typed name is a shorter form of exactly one
// known street ("בן זאב" for "בן זאב ישראל") — that street's key.
function resolveKey(table: StreetTable, key: string): string | null {
  if (table.streets[key]) return key
  const words = key.split(' ')
  if (words.length === 0 || key.length < 3) return null
  const hits = Object.keys(table.streets).filter(k => {
    const kw = k.split(' ')
    return words.every(w => kw.includes(w))
  })
  return hits.length === 1 ? hits[0] : null
}

export function neighborhoodsForAddress(table: StreetTable, address: string): NeighborhoodMatch {
  const { street, number } = parseAddress(cleanAddress(address))
  if (!street) return NO_MATCH
  const key = resolveKey(table, streetKey(street))
  if (!key) return NO_MATCH
  const byNumber = number ? table.houses[key]?.[number] : undefined
  if (byNumber) return { options: [byNumber], byHouse: true }
  return { options: table.streets[key], byHouse: false }
}

let tablePromise: Promise<StreetTable | null> | null = null

export function useStreetTable(): StreetTable | null {
  const [table, setTable] = useState<StreetTable | null>(null)
  useEffect(() => {
    let cancelled = false
    tablePromise ??= import('../../data/street_neighborhoods.json')
      .then(m => m.default as StreetTable)
      .catch(() => null)
    tablePromise.then(t => { if (!cancelled) setTable(t) })
    return () => { cancelled = true }
  }, [])
  return table
}
