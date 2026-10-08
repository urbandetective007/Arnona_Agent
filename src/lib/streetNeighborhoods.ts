'use client'

import { useEffect, useState } from 'react'
import { cleanAddress, parseAddress } from './geocode'

// Street → neighborhood table, built by tools/neighborhoods/build_street_index.py
// from the agent's address list and the municipality's street list. Loaded with
// a dynamic import, so it's a separate chunk fetched only by pages that need it
// (manual entry) and doesn't weigh on the rest of the site.

export interface StreetTable {
  streets: Record<string, string[]>
  /** Street name as usually written, to show which street was recognized. */
  names: Record<string, string>
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

/** How the typed street was matched: as written, as a shorter form of one
 *  known street ("בן זאב" → "בן זאב ישראל"), or by a close spelling
 *  ("מקסיקו" → "מכסיקו") — the last one is a guess worth checking. */
export type StreetMatchKind = 'exact' | 'partial' | 'close'

export interface NeighborhoodMatch {
  /** Candidate neighborhoods, most likely first. Empty when the street isn't known. */
  options: string[]
  /** True when a known house number pinned it to one neighborhood. */
  byHouse: boolean
  /** The recognized street's usual name, or null when nothing matched. */
  street: string | null
  match: StreetMatchKind | null
}

export const NO_MATCH: NeighborhoodMatch = { options: [], byHouse: false, street: null, match: null }

// Optimal-string-alignment distance: edits, counting a swap of two adjacent
// letters as one ("קאסטו" / "קאסוטו").
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

const CLOSE_MIN_SIMILARITY = 0.8
const CLOSE_MIN_LENGTH = 4

function resolveKey(table: StreetTable, key: string): { key: string; match: StreetMatchKind } | null {
  if (table.streets[key]) return { key, match: 'exact' }
  if (key.length < 3) return null
  const words = key.split(' ')
  const keys = Object.keys(table.streets)
  const partial = keys.filter(k => {
    const kw = k.split(' ')
    return words.every(w => kw.includes(w))
  })
  if (partial.length === 1) return { key: partial[0], match: 'partial' }
  if (key.length < CLOSE_MIN_LENGTH) return null
  let best: string | null = null
  let bestScore = 0
  for (const k of keys) {
    if (Math.abs(k.length - key.length) > 3) continue
    const score = 1 - editDistance(key, k) / Math.max(k.length, key.length)
    if (score > bestScore) { best = k; bestScore = score }
  }
  return best && bestScore >= CLOSE_MIN_SIMILARITY ? { key: best, match: 'close' } : null
}

export function neighborhoodsForAddress(table: StreetTable, address: string): NeighborhoodMatch {
  const { street, number } = parseAddress(cleanAddress(address))
  if (!street) return NO_MATCH
  const hit = resolveKey(table, streetKey(street))
  if (!hit) return NO_MATCH
  const name = table.names?.[hit.key] ?? hit.key
  const byNumber = number ? table.houses[hit.key]?.[number] : undefined
  if (byNumber) return { options: [byNumber], byHouse: true, street: name, match: hit.match }
  return { options: table.streets[hit.key], byHouse: false, street: name, match: hit.match }
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
