// Refreshes public/geocoded_addresses.json — the pre-computed coordinates the
// property map uses, so browsers rarely need to geocode live.
//
// Usage:
//   node scripts/geocode-addresses.mjs <addresses-file>
//
// <addresses-file> has one property per line: "address¦neighborhood"
// (neighborhood may be empty). Export it from Supabase with:
//   select string_agg(address || '¦' || coalesce(neighborhood,''), E'\n')
//   from (select distinct address, neighborhood from businesses
//         where address is not null and address <> '') t
//
// Every address is (re)placed with the same logic the map uses
// (src/lib/geocode.ts): inside Jerusalem only, house → street → neighborhood.
// Existing entries are kept only if OpenStreetMap confirms they're in
// Jerusalem. Progress is checkpointed to the JSON file as it goes, so an
// interrupted run can simply be restarted.
//
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so fetch uses HTTPS_PROXY.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanAddress, neighborhoodHint, geocodeAddress, nominatimSearchUrl, RateLimitError,
} from '../src/lib/geocode.ts'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE_FILE = path.join(ROOT, 'public', 'geocoded_addresses.json')
const USER_AGENT = 'ArnonaAgentProject/1.0 (Jerusalem municipality property map)'
const DELAY_MS = 1300
const sleep = ms => new Promise(r => setTimeout(r, ms))

const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: node scripts/geocode-addresses.mjs <addresses-file>')
  process.exit(1)
}

async function nominatim(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he' } })
  if (res.status === 429) throw new RateLimitError('429')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const search = query => nominatim(nominatimSearchUrl(query))

async function reverseIsJerusalem({ lat, lon }) {
  const data = await nominatim(
    `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lon}`,
  )
  const a = data.address ?? {}
  return /ירושלים|jerusalem/i.test([a.city, a.town, a.municipality, a.village].find(Boolean) ?? '')
}

// Retries temporary failures (rate limiting, network) with backoff.
async function withRetry(fn) {
  let wait = 30_000
  for (;;) {
    try { return await fn() } catch (e) {
      console.warn(`  temporary failure (${e.message}) — retrying in ${wait / 1000}s`)
      await sleep(wait)
      wait = Math.min(wait * 2, 300_000)
    }
  }
}

const distanceM = (a, b) => {
  const dLat = (a.lat - b.lat) * 111_320
  const dLon = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.round(Math.hypot(dLat, dLon))
}

// One entry per clean address (the map's cache key); first non-empty hint wins.
const todo = new Map()
for (const line of fs.readFileSync(inputFile, 'utf8').split('\n')) {
  if (!line.trim()) continue
  const [address, neighborhood = ''] = line.split('¦')
  const key = cleanAddress(address)
  if (!key) continue
  const hint = neighborhoodHint(address, neighborhood)
  if (!todo.has(key) || (!todo.get(key) && hint)) todo.set(key, hint)
}

const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
const done = new Set(Object.entries(cache).filter(([, v]) => v?.verified).map(([k]) => k))
const stats = { exact: 0, street: 0, neighborhood: 0, kept: 0, notFound: 0 }
const report = { moved: [], notExact: [], notFound: [], removed: [] }

const save = () => {
  const out = {}
  for (const k of Object.keys(cache).sort()) out[k] = cache[k]
  fs.writeFileSync(CACHE_FILE, JSON.stringify(out, null, 2) + '\n')
}

let i = 0
for (const [key, hint] of todo) {
  i++
  if (done.has(key)) { stats[cache[key].precision ?? 'exact']++; continue }
  process.stdout.write(`[${i}/${todo.size}] ${key} … `)
  const previous = cache[key]
  const result = await withRetry(() => geocodeAddress(key, hint, { search, delayMs: DELAY_MS }))
  await sleep(DELAY_MS)

  if (result) {
    stats[result.precision]++
    if (previous && distanceM(previous, result) > 300) {
      report.moved.push(`${key}: moved ${distanceM(previous, result)}m`)
    }
    if (result.precision !== 'exact') report.notExact.push(`${key} → ${result.precision}`)
    cache[key] = { lat: result.lat, lon: result.lon, precision: result.precision, verified: true }
    console.log(result.precision)
  } else if (previous && await withRetry(() => reverseIsJerusalem(previous))) {
    // OSM can't find it by name, but the old coordinates are in Jerusalem.
    stats.kept++
    cache[key] = { ...previous, verified: true }
    report.notExact.push(`${key} → kept previous coordinates`)
    console.log('kept previous')
    await sleep(DELAY_MS)
  } else {
    stats.notFound++
    if (previous) { delete cache[key]; report.removed.push(key) }
    report.notFound.push(key)
    console.log('NOT FOUND')
  }
  if (i % 10 === 0) save()
}
save()

console.log('\n=== Summary ===')
console.log(stats)
for (const [name, list] of Object.entries(report)) {
  if (list.length) console.log(`\n${name} (${list.length}):\n  ` + list.join('\n  '))
}
